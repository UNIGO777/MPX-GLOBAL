import { useCallback, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { catalogueApi } from '../api/catalogue.js';
import { sellerProductsApi } from '../api/sellerProducts.js';
import { Button } from '../components/Button.jsx';
import { CountryPicker } from '../components/CountryPicker.jsx';
import { ErrorState, Spinner } from '../components/Feedback.jsx';
import { Input } from '../components/Input.jsx';
import { useToast } from '../components/Toast.jsx';
import { findCountry } from '../constants/countries.js';
import { CURRENCIES } from '../constants/currencies.js';
import { colors, radii, spacing, typography, MIN_TOUCH_TARGET } from '../theme/index.js';
import { toAppError } from '../utils/errors.js';

/**
 * M2 app screen 7 — product form, add + edit (built 2026-08-18). The app's
 * biggest form; keyboard behaviour and section rhythm are the design
 * (static header, scrolling body, Save pinned above the keyboard).
 *
 * Two entries:
 * - CREATE — pushed by the category picker with the chosen SUB (`mode:
 *   'create'` + category params). Saving always creates a DRAFT; publishing
 *   is offered right after, as its own status call.
 * - EDIT — `{ productId }` from My products. Hydrates from the owner read
 *   (image REFS included — PATCH replaces the whole array, so publicIds must
 *   round-trip).
 *
 * Contract points this screen is built around, not re-decided:
 * - Draft-save is LOOSE: name + category + a valid price shape is enough
 *   (M2 brief). Required specs, images-less publishes, goods `moq`+`unit`
 *   (integer ≥ 1 — owner 2026-08-17, M3-parity §0.1) are all enforced BY THE
 *   SERVER AT PUBLISH — refusals show the server's message verbatim.
 * - 🔴 No goods/service toggle exists anywhere: the picked sub's `type`
 *   silently decides which fixed-field set renders (§A14/§A16).
 * - "Change" re-opens the picker (`changeFor`), and applying a different
 *   category WARNS first when specs are filled — the change clears them.
 * - Photos: camera FIRST, gallery second, no file browser (product photos,
 *   not PDFs). Max 5 × 5 MB, limits stated before capture. Each photo
 *   uploads the moment it's taken (`POST /products/images`) with per-photo
 *   progress/retry — one failure never blocks the others or the form.
 *   First image is the cover; "Make cover" moves one to the front (drag
 *   reorder is deliberately not hand-rolled).
 * - Rename on edit shows "Your product's web address stays the same."
 *   (slug immutable, §A6). Archived products never reach this screen
 *   (My products blocks them); a blocked product edits normally under its
 *   takedown banner but has no Publish/Hide here.
 * - Backgrounding loses nothing (state is in memory; photos already
 *   uploaded). Leaving CREATE with unsaved edits confirms first.
 */
const MAX_IMAGES = 5; // server MAX_PRODUCT_IMAGES — enforced there too
const PRICE_MODES = [
  { key: 'fixed', label: 'Fixed' },
  { key: 'range', label: 'Range' },
  { key: 'on_request', label: 'On request' },
];

// Type-driven fixed fields (§A14): label · state key · props.
const GOODS_FIELDS = [
  ['HS code', 'hsCode', { autoCapitalize: 'characters', maxLength: 20 }],
  ['Supply ability', 'supplyAbility', { placeholder: 'e.g. 10,000 meters / month', maxLength: 200 }],
  ['Lead time', 'leadTime', { placeholder: 'e.g. 3 weeks', maxLength: 200 }],
  ['Packaging', 'packaging', { placeholder: 'e.g. rolls of 50 m, export cartons', maxLength: 500 }],
  ['Payment terms', 'terms', { placeholder: 'e.g. 40% advance, 60% on shipment', maxLength: 500 }],
];
const SERVICE_FIELDS = [
  ['Engagement type', 'engagementType', { placeholder: 'Project / hourly / dedicated team', maxLength: 120 }],
  ['Delivery model', 'deliveryModel', { placeholder: 'Remote / onsite / hybrid', maxLength: 120 }],
  ['Team size', 'teamSize', { placeholder: 'e.g. 3–5 engineers', maxLength: 60 }],
  ['Pricing model', 'pricingModel', { placeholder: 'Fixed bid / monthly retainer', maxLength: 120 }],
  ['Timeline', 'timeline', { placeholder: 'e.g. 6–8 weeks', maxLength: 200 }],
];

export function ProductFormScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const isEdit = route.params?.productId != null;

  const [boot, setBoot] = useState({ loading: isEdit, error: null });
  // The category the form is FOR — create: from the picker; edit: fetched.
  const [category, setCategory] = useState(
    isEdit
      ? null
      : {
          id: route.params?.categoryId,
          name: route.params?.categoryName ?? '—',
          type: route.params?.categoryType ?? null,
          parentName: route.params?.parentName ?? null,
        },
  );
  const [defs, setDefs] = useState([]);
  const [productId, setProductId] = useState(route.params?.productId ?? null);
  const [original, setOriginal] = useState(null); // edit: the loaded ownView

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]); // {url,publicId} | {localUri,uploading} | {localUri,failed,file}
  const [price, setPrice] = useState({ mode: 'fixed', min: '', max: '', currency: 'INR' });
  const [fields, setFields] = useState({}); // fixed goods/service text fields
  // Country of origin is held as the picker's own OBJECT shape; the payload
  // sends `.code`. See the CountryPicker note in the render.
  const [originCountry, setOriginCountry] = useState(null);
  const [specs, setSpecs] = useState({}); // dynamic attribute values by key
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [photoSheet, setPhotoSheet] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [specSheet, setSpecSheet] = useState(null); // a select-type def

  const dirtyRef = useRef(false);
  const savedRef = useRef(false);
  const markDirty = () => {
    dirtyRef.current = true;
  };

  /**
   * 🔴 Never assume a stack depth here. `pop(2)` used to close the create
   * flow (form + picker) and threw "The action 'GO_BACK' was not handled by
   * any navigator" whenever that guess was wrong — most reliably after a Fast
   * Refresh, when a native Alert's callback outlives the reloaded stack and
   * fires against a fresh one that is already at its root.
   * `popToTop()` is depth-agnostic and a NO-OP when there is nothing to pop;
   * the stack's first route is `Tabs`, which is exactly where finishing the
   * add flow should land. `goBack` is guarded for the same reason.
   */
  const closeFlow = () => navigation.popToTop();
  const goBackSafely = () => {
    if (navigation.canGoBack()) navigation.goBack();
  };

  // ---- boot: edit hydration --------------------------------------------------
  const hydrate = useCallback(async () => {
    setBoot({ loading: true, error: null });
    try {
      const p = await sellerProductsApi.get(route.params.productId);
      setOriginal(p);
      setName(p.name ?? '');
      setDescription(p.description ?? '');
      setImages((p.images ?? []).map((r) => ({ url: r.url, publicId: r.publicId })));
      setPrice({
        mode: p.price?.mode ?? 'fixed',
        min: p.price?.min != null ? String(p.price.min) : '',
        max: p.price?.max != null ? String(p.price.max) : '',
        currency: p.price?.currency ?? 'INR',
      });
      setFields({
        moq: p.moq != null ? String(p.moq) : '',
        unit: p.unit ?? '',
        hsCode: p.hsCode ?? '',
        supplyAbility: p.supplyAbility ?? '',
        leadTime: p.leadTime ?? '',
        packaging: p.packaging ?? '',
        terms: p.terms ?? '',
        engagementType: p.engagementType ?? '',
        deliveryModel: p.deliveryModel ?? '',
        teamSize: p.teamSize ?? '',
        pricingModel: p.pricingModel ?? '',
        timeline: p.timeline ?? '',
      });
      // Stored as an ISO code; the picker needs its object back.
      setOriginCountry(p.countryOfOrigin ? (findCountry(p.countryOfOrigin) ?? null) : null);
      setSpecs(Object.fromEntries((p.attributes ?? []).map((a) => [a.key, a.value])));
      // Category decorates the summary + selects the field set. A deactivated
      // category 404s publicly — degrade to id-only rather than failing the form.
      const cat = await catalogueApi.category(p.categoryId).catch(() => null);
      setCategory({
        id: p.categoryId,
        name: cat?.name ?? 'Category unavailable',
        type: cat?.type ?? (p.engagementType != null || p.pricingModel != null ? 'service' : 'goods'),
        parentName: null,
      });
      setBoot({ loading: false, error: null });
    } catch (error) {
      setBoot({ loading: false, error: toAppError(error) });
    }
  }, [route.params?.productId]);

  useEffect(() => {
    if (isEdit) hydrate();
  }, [isEdit, hydrate]);

  // ---- attribute definitions for the current category ------------------------
  useEffect(() => {
    if (!category?.id) return;
    let alive = true;
    catalogueApi
      .categoryAttributes(category.id)
      .then((d) => alive && setDefs(d ?? []))
      .catch(() => alive && setDefs([])); // degrade: specs render from raw keys
    return () => {
      alive = false;
    };
  }, [category?.id]);

  // ---- "Change category" round-trip ------------------------------------------
  useEffect(() => {
    const changed = route.params?.changedCategory;
    if (!changed || changed.categoryId === category?.id) return;
    const apply = () => {
      setCategory({
        id: changed.categoryId,
        name: changed.categoryName,
        type: changed.categoryType,
        parentName: changed.parentName ?? null,
      });
      setSpecs({});
      markDirty();
      navigation.setParams({ changedCategory: undefined });
    };
    const hasSpecs = Object.values(specs).some((v) => v !== '' && v != null);
    if (hasSpecs) {
      Alert.alert('Change category?', 'Changing category clears the specifications you’ve filled in.', [
        { text: 'Keep current', style: 'cancel', onPress: () => navigation.setParams({ changedCategory: undefined }) },
        { text: 'Change', style: 'destructive', onPress: apply },
      ]);
    } else {
      apply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.changedCategory]);

  // ---- leave-guard (create only) ----------------------------------------------
  useEffect(() => {
    if (isEdit) return undefined;
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current || savedRef.current) return;
      e.preventDefault();
      Alert.alert('Discard this product?', 'Nothing has been saved yet.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return sub;
  }, [navigation, isEdit]);

  // ---- photos -----------------------------------------------------------------
  const startUpload = async (asset) => {
    const file = {
      uri: asset.uri,
      name: asset.fileName ?? `product-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
    };
    const localUri = asset.uri;
    setImages((list) => [...list, { localUri, uploading: true, file }]);
    markDirty();
    try {
      const ref = await sellerProductsApi.uploadImage(file);
      setImages((list) => list.map((i) => (i.localUri === localUri ? { ...ref, localUri } : i)));
    } catch (error) {
      setImages((list) => list.map((i) => (i.localUri === localUri ? { localUri, failed: true, file } : i)));
      toast.show(toAppError(error).message, { tone: 'danger' });
    }
  };

  const retryUpload = async (img) => {
    setImages((list) => list.map((i) => (i === img ? { ...img, failed: false, uploading: true } : i)));
    try {
      const ref = await sellerProductsApi.uploadImage(img.file);
      setImages((list) => list.map((i) => (i.localUri === img.localUri ? { ...ref, localUri: img.localUri } : i)));
    } catch (error) {
      setImages((list) => list.map((i) => (i.localUri === img.localUri ? { ...img, failed: true } : i)));
      toast.show(toAppError(error).message, { tone: 'danger' });
    }
  };

  const takePhoto = async () => {
    setPhotoSheet(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast.show('Camera access is off — you can still choose from the gallery.', { tone: 'neutral' });
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8, exif: false });
    if (!res.canceled && res.assets?.[0]) startUpload(res.assets[0]);
  };

  const pickFromGallery = async () => {
    setPhotoSheet(false);
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      exif: false,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
    });
    if (!res.canceled) (res.assets ?? []).slice(0, MAX_IMAGES - images.length).forEach(startUpload);
  };

  const removeImage = (img) => {
    setImages((list) => list.filter((i) => i !== img));
    markDirty();
  };
  /**
   * Reorder by one position. The brief asks for drag-to-reorder; literal
   * dragging needs a gesture library this project doesn't have (a new
   * dependency is the owner's call, per CLAUDE.md), and hand-rolling a drag
   * inside a wrapping grid is exactly the kind of fragile code that breaks
   * silently. Explicit ← → moves give the SAME capability — any photo to any
   * position, first = cover — with none of that risk, and they're precise on
   * a phone and reachable by screen readers.
   */
  const move = (index, delta) => {
    const target = index + delta;
    setImages((list) => {
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markDirty();
  };

  // ---- payload + save ---------------------------------------------------------
  const isService = category?.type === 'service';
  const fixedFieldDefs = isService ? SERVICE_FIELDS : GOODS_FIELDS;

  const buildPayload = () => {
    const clean = (v) => {
      const t = typeof v === 'string' ? v.trim() : v;
      return t === '' || t == null ? undefined : t;
    };
    const priceOut =
      price.mode === 'on_request'
        ? { mode: 'on_request' }
        : price.mode === 'range'
          ? { mode: 'range', min: Number(price.min), max: Number(price.max), currency: price.currency }
          : { mode: 'fixed', min: Number(price.min), currency: price.currency };

    const attributes = [];
    for (const def of defs) {
      const v = specs[def.key];
      if (v === '' || v == null) continue;
      if (def.inputType === 'number') {
        const n = Number(v);
        if (!Number.isNaN(n)) attributes.push({ key: def.key, value: n });
      } else {
        attributes.push({ key: def.key, value: v });
      }
    }
    // Values whose definition disappeared (category changed server-side) still
    // belong to the product on edit — carry them through untouched.
    const known = new Set(defs.map((d) => d.key));
    for (const [key, v] of Object.entries(specs)) {
      if (!known.has(key) && v !== '' && v != null) attributes.push({ key, value: v });
    }

    const body = {
      name: clean(name),
      description: clean(description),
      categoryId: category.id,
      price: priceOut,
      images: images.filter((i) => i.publicId).map((i) => ({ url: i.url, publicId: i.publicId })),
      attributes,
    };
    if (isService) {
      for (const [, key] of SERVICE_FIELDS) body[key] = clean(fields[key]);
    } else {
      body.moq = fields.moq?.trim() ? Number(fields.moq) : undefined;
      body.unit = clean(fields.unit);
      body.countryOfOrigin = originCountry?.code ?? undefined;
      for (const [, key] of GOODS_FIELDS) body[key] = clean(fields[key]);
    }
    return body;
  };

  const clientCheck = () => {
    if (!name.trim()) return 'Give the product a name first.';
    if (price.mode === 'fixed' && !price.min.trim()) return 'Enter the fixed price (or switch to “On request”).';
    if (price.mode === 'range') {
      if (!price.min.trim() || !price.max.trim()) return 'A price range needs both min and max.';
      if (Number(price.min) >= Number(price.max)) return 'The range’s min must be below its max.';
    }
    if (images.some((i) => i.uploading)) return 'A photo is still uploading — give it a second.';
    return null;
  };

  const save = async () => {
    const problem = clientCheck();
    if (problem) {
      Alert.alert('Not quite yet', problem);
      return;
    }
    setSaving(true);
    try {
      if (productId) {
        await sellerProductsApi.update(productId, buildPayload());
        savedRef.current = true;
        toast.show('Saved.', { tone: 'success' });
        goBackSafely();
      } else {
        const created = await sellerProductsApi.create(buildPayload());
        savedRef.current = true;
        setProductId(created.id);
        Alert.alert('Saved as draft', 'Publish it now so buyers can find it?', [
          { text: 'Later', onPress: closeFlow },
          {
            text: 'Publish now',
            onPress: async () => {
              try {
                await sellerProductsApi.setStatus(created.id, 'active');
                toast.show('Published — the listing is live.', { tone: 'success' });
              } catch (error) {
                // Server names the blocker (cap / required specs / moq+unit).
                Alert.alert('Saved, but not published', toAppError(error).message);
              } finally {
                closeFlow();
              }
            },
          },
        ]);
      }
    } catch (error) {
      Alert.alert('Couldn’t save', toAppError(error).message);
    } finally {
      setSaving(false);
    }
  };

  const runStatus = async (status) => {
    setPublishing(true);
    try {
      await sellerProductsApi.setStatus(productId, status);
      toast.show(status === 'active' ? 'Published — the listing is live.' : 'Hidden from the catalogue.', {
        tone: 'success',
      });
      goBackSafely();
    } catch (error) {
      Alert.alert(status === 'active' ? 'Couldn’t publish' : 'Couldn’t hide', toAppError(error).message);
    } finally {
      setPublishing(false);
    }
  };

  // ---- render -----------------------------------------------------------------
  if (boot.loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <Spinner label="Loading product…" />
      </View>
    );
  }
  if (boot.error) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <ErrorState error={boot.error} onRetry={hydrate} />
      </View>
    );
  }

  const renamed = isEdit && original && name.trim() !== original.name;
  const currencyResults = currencyQuery.trim()
    ? CURRENCIES.filter((c) => c.toLowerCase().includes(currencyQuery.trim().toLowerCase()))
    : CURRENCIES;

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* Static header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing[2] }]}>
          <Pressable
            onPress={goBackSafely}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.ink[900]} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {isEdit ? 'Edit product' : 'Add product'}
          </Text>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Edit: status strip (+ takedown banner). Blocked = no lifecycle. */}
          {isEdit && original ? (
            <>
              {original.takedown ? (
                <View style={styles.blockedBanner}>
                  <Ionicons name="alert-circle" size={18} color={colors.danger.DEFAULT} accessible={false} />
                  <Text style={styles.blockedText}>
                    Removed by the MPX team{original.takedown.at ? ` on ${formatDate(original.takedown.at)}` : ''}
                    {original.takedown.reason ? ` — “${original.takedown.reason}”` : ''}. You can still edit; it
                    can’t be published or hidden until it’s restored.
                  </Text>
                </View>
              ) : (
                <View style={styles.statusStrip}>
                  <Text style={styles.statusLabel}>
                    Status: <Text style={styles.statusValue}>{statusLabel(original.status)}</Text>
                  </Text>
                  {original.status === 'active' ? (
                    <Button
                      label="Hide"
                      variant="secondary"
                      fullWidth={false}
                      loading={publishing}
                      onPress={() => runStatus('inactive')}
                    />
                  ) : (
                    <Button
                      label="Publish"
                      variant="secondary"
                      fullWidth={false}
                      loading={publishing}
                      onPress={() => runStatus('active')}
                    />
                  )}
                </View>
              )}
            </>
          ) : null}

          {/* 1 · Category */}
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.categoryCard}>
            <View style={styles.categoryText}>
              <Text style={styles.categoryName} numberOfLines={1}>
                {category?.parentName ? `${category.parentName} → ` : ''}
                {category?.name}
              </Text>
              <Text style={styles.categoryMeta}>Decides which details we ask for</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('ProductCategoryPicker', { changeFor: true })}
              accessibilityRole="button"
              accessibilityLabel="Change category"
              hitSlop={8}
            >
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>

          {/* 2 · Details */}
          <Text style={styles.sectionLabel}>Details</Text>
          <Input
            label="Product name"
            required
            value={name}
            onChangeText={(v) => {
              setName(v);
              markDirty();
            }}
            placeholder="e.g. Combed Cotton Poplin Fabric, 120 GSM"
            maxLength={200}
            helperText={renamed ? 'Your product’s web address stays the same.' : undefined}
          />
          <Input
            label="Description"
            value={description}
            onChangeText={(v) => {
              setDescription(v);
              markDirty();
            }}
            placeholder="Details, use cases, certifications…"
            multiline
            numberOfLines={5}
            maxLength={5000}
            style={styles.multiline}
            helperText={`${description.length}/5000`}
          />

          {/* 3 · Photos */}
          <Text style={styles.sectionLabel}>Photos</Text>
          <Text style={styles.photoHelper}>First photo is the cover · up to {MAX_IMAGES} × 5 MB (JPG/PNG/WEBP)</Text>
          <View style={styles.photoRow}>
            {images.map((img, i) => (
              <View key={img.publicId ?? img.localUri} style={styles.photoTile}>
                <Image source={{ uri: img.url ?? img.localUri }} style={styles.photoImage} />
                {i === 0 && img.publicId ? (
                  <View style={styles.coverTag}>
                    <Text style={styles.coverTagText}>Cover</Text>
                  </View>
                ) : null}
                {img.uploading ? (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator size="small" color={colors.white} />
                  </View>
                ) : null}
                {img.failed ? (
                  <Pressable style={styles.photoOverlay} onPress={() => retryUpload(img)} accessibilityRole="button">
                    <Ionicons name="refresh" size={18} color={colors.white} />
                    <Text style={styles.photoOverlayText}>Retry</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => removeImage(img)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  style={styles.photoRemove}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </Pressable>
                {/* Reorder — only once the photo is a real upload; a still-
                    uploading or failed tile has no place to move to yet. */}
                {img.publicId && images.length > 1 ? (
                  <View style={styles.moveRow}>
                    <Pressable
                      onPress={() => move(i, -1)}
                      disabled={i === 0}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Move photo earlier"
                      style={({ pressed }) => [
                        styles.moveButton,
                        i === 0 && styles.moveButtonOff,
                        pressed && i !== 0 && styles.movePressed,
                      ]}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={14}
                        color={i === 0 ? colors.ink[300] : colors.primary[700]}
                        accessible={false}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => move(i, 1)}
                      disabled={i === images.length - 1}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel="Move photo later"
                      style={({ pressed }) => [
                        styles.moveButton,
                        i === images.length - 1 && styles.moveButtonOff,
                        pressed && i !== images.length - 1 && styles.movePressed,
                      ]}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={i === images.length - 1 ? colors.ink[300] : colors.primary[700]}
                        accessible={false}
                      />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
            {images.length < MAX_IMAGES ? (
              <Pressable
                onPress={() => setPhotoSheet(true)}
                accessibilityRole="button"
                accessibilityLabel="Add photo"
                style={({ pressed }) => [styles.addPhoto, pressed && styles.addPhotoPressed]}
              >
                <Ionicons name="camera-outline" size={22} color={colors.primary[600]} accessible={false} />
                <Text style={styles.addPhotoText}>Add</Text>
              </Pressable>
            ) : null}
          </View>

          {/* 4 · Price */}
          <Text style={styles.sectionLabel}>Price</Text>
          <View style={styles.segmentRow}>
            {PRICE_MODES.map((m) => {
              const active = price.mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => {
                    setPrice((p) => ({ ...p, mode: m.key }));
                    markDirty();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.segment, active && styles.segmentActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {price.mode === 'on_request' ? (
            <Text style={styles.onRequestNote}>Buyers will see “Price on request”.</Text>
          ) : (
            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Input
                  label={price.mode === 'range' ? 'Min' : 'Amount'}
                  required
                  value={price.min}
                  onChangeText={(v) => {
                    setPrice((p) => ({ ...p, min: v }));
                    markDirty();
                  }}
                  keyboardType="numeric"
                  placeholder="0"
                />
              </View>
              {price.mode === 'range' ? (
                <View style={styles.priceField}>
                  <Input
                    label="Max"
                    required
                    value={price.max}
                    onChangeText={(v) => {
                      setPrice((p) => ({ ...p, max: v }));
                      markDirty();
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              ) : null}
              <Pressable
                onPress={() => setCurrencyOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Currency"
                style={styles.currencyButton}
              >
                <Text style={styles.currencyText}>{price.currency}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.ink[600]} accessible={false} />
              </Pressable>
            </View>
          )}

          {/* 5 · Type-driven fixed fields — the sub decides, silently. */}
          <Text style={styles.sectionLabel}>{isService ? 'Service details' : 'Trade details'}</Text>
          {!isService ? (
            <View style={styles.priceRow}>
              <View style={styles.priceField}>
                <Input
                  label="MOQ"
                  value={fields.moq ?? ''}
                  onChangeText={(v) => {
                    setFields((f) => ({ ...f, moq: v }));
                    markDirty();
                  }}
                  keyboardType="number-pad"
                  placeholder="e.g. 500"
                  helperText="Required to publish"
                />
              </View>
              <View style={styles.priceField}>
                <Input
                  label="Unit"
                  value={fields.unit ?? ''}
                  onChangeText={(v) => {
                    setFields((f) => ({ ...f, unit: v }));
                    markDirty();
                  }}
                  placeholder="meter / kg / piece"
                  maxLength={40}
                  helperText="Required to publish"
                />
              </View>
            </View>
          ) : null}
          {!isService ? (
            /* 🔴 `CountryPicker` speaks in COUNTRY OBJECTS, both ways: its
               `value` is the object (it reads `.name`/`.dial`) and its
               `onChange` hands the object back — not the code. The payload
               needs the ISO alpha-2 code, so the object is held in its own
               state slot and `.code` is what gets sent (see buildPayload).
               Passing the raw string here sent the whole object to the
               server and every save 400'd with "Invalid request." */
            <CountryPicker
              label="Country of origin"
              value={originCountry}
              onChange={(country) => {
                setOriginCountry(country);
                markDirty();
              }}
            />
          ) : null}
          {fixedFieldDefs.map(([label, key, props]) => (
            <Input
              key={key}
              label={label}
              value={fields[key] ?? ''}
              onChangeText={(v) => {
                setFields((f) => ({ ...f, [key]: v }));
                markDirty();
              }}
              {...props}
            />
          ))}

          {/* 6 · Specifications — the category's dynamic fields. */}
          {defs.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Specifications</Text>
              <Text style={styles.photoHelper}>Required ones are checked when you publish, not while drafting.</Text>
              {defs.map((def) => (
                <SpecField
                  key={def.key}
                  def={def}
                  value={specs[def.key]}
                  onChange={(v) => {
                    setSpecs((s) => ({ ...s, [def.key]: v }));
                    markDirty();
                  }}
                  onOpenSelect={() => setSpecSheet(def)}
                />
              ))}
            </>
          ) : null}
        </ScrollView>

        {/* Pinned above the keyboard */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          <Button
            label={isEdit ? 'Save changes' : 'Save draft'}
            loading={saving}
            onPress={save}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Photo source sheet — camera FIRST (brief). */}
      <Modal visible={photoSheet} transparent animationType="slide" onRequestClose={() => setPhotoSheet(false)}>
        <View style={styles.sheetScrim}>
          <Pressable style={styles.sheetScrimTouch} onPress={() => setPhotoSheet(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }]}>
            <Text style={styles.sheetTitle}>Add photo</Text>
            <Pressable onPress={takePhoto} accessibilityRole="button" style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}>
              <Ionicons name="camera-outline" size={20} color={colors.ink[800]} accessible={false} />
              <Text style={styles.sheetRowText}>Take photo</Text>
            </Pressable>
            <Pressable onPress={pickFromGallery} accessibilityRole="button" style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}>
              <Ionicons name="images-outline" size={20} color={colors.ink[800]} accessible={false} />
              <Text style={styles.sheetRowText}>Choose from gallery</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Currency sheet — searchable, server's own 154 codes. */}
      <Modal visible={currencyOpen} transparent animationType="slide" onRequestClose={() => setCurrencyOpen(false)}>
        <View style={styles.sheetScrim}>
          <Pressable style={styles.sheetScrimTouch} onPress={() => setCurrencyOpen(false)} />
          <View style={[styles.sheet, styles.tallSheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }]}>
            <Text style={styles.sheetTitle}>Currency</Text>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={colors.ink[400]} accessible={false} />
              <TextInput
                value={currencyQuery}
                onChangeText={setCurrencyQuery}
                placeholder="Search ISO code…"
                placeholderTextColor={colors.ink[400]}
                style={styles.searchInput}
                autoCapitalize="characters"
              />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              {currencyResults.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => {
                    setPrice((p) => ({ ...p, currency: c }));
                    setCurrencyOpen(false);
                    setCurrencyQuery('');
                    markDirty();
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
                >
                  <Text style={styles.sheetRowText}>{c}</Text>
                  {price.currency === c ? (
                    <Ionicons name="checkmark" size={18} color={colors.primary[600]} accessible={false} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Select-type spec sheet */}
      <Modal visible={specSheet != null} transparent animationType="slide" onRequestClose={() => setSpecSheet(null)}>
        <View style={styles.sheetScrim}>
          <Pressable style={styles.sheetScrimTouch} onPress={() => setSpecSheet(null)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing[5]) }]}>
            <Text style={styles.sheetTitle}>{specSheet?.name}</Text>
            <ScrollView style={styles.optionList}>
              {(specSheet?.options ?? []).map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => {
                    setSpecs((s) => ({ ...s, [specSheet.key]: opt }));
                    setSpecSheet(null);
                    markDirty();
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
                >
                  <Text style={styles.sheetRowText}>{opt}</Text>
                  {specSheet && specs[specSheet.key] === opt ? (
                    <Ionicons name="checkmark" size={18} color={colors.primary[600]} accessible={false} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** One dynamic attribute field, by inputType (M2 brief §2's renderer):
 *  text → input · number → numeric with the unit INSIDE the field ·
 *  select → picker sheet row · boolean → switch. */
function SpecField({ def, value, onChange, onOpenSelect }) {
  if (def.inputType === 'boolean') {
    return (
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>
          {def.name}
          {def.required ? <Text style={styles.req}> *</Text> : null}
        </Text>
        <Switch
          value={value === true}
          onValueChange={(v) => onChange(v)}
          trackColor={{ false: colors.ink[200], true: colors.primary[300] }}
          thumbColor={value === true ? colors.primary[600] : colors.white}
        />
      </View>
    );
  }
  if (def.inputType === 'select') {
    return (
      <Pressable onPress={onOpenSelect} accessibilityRole="button" accessibilityLabel={def.name}>
        <View pointerEvents="none">
          <Input
            label={def.name}
            required={def.required}
            value={value != null ? String(value) : ''}
            placeholder="Select…"
            editable={false}
          />
        </View>
      </Pressable>
    );
  }
  const isNumber = def.inputType === 'number';
  return (
    <View style={styles.specNumberWrap}>
      <Input
        label={def.name}
        required={def.required}
        value={value != null ? String(value) : ''}
        onChangeText={onChange}
        keyboardType={isNumber ? 'numeric' : 'default'}
        placeholder={isNumber && def.unit ? `e.g. 120 (${def.unit})` : undefined}
        helperText={isNumber && def.unit ? `In ${def.unit}` : undefined}
      />
    </View>
  );
}

function statusLabel(status) {
  return { active: 'Live', draft: 'Draft', inactive: 'Hidden', archived: 'Archived' }[status] ?? status;
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface.DEFAULT },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  backButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: { ...typography.h2, color: colors.ink[900], flex: 1 },

  // `gap` spaces every direct child uniformly (owner, 2026-08-19: "make some
  // space between fields" — stacked Inputs were touching, since Input carries
  // no outer margin of its own). Section labels and helpers below had their
  // hand-rolled margins trimmed so this gap is the single source of rhythm.
  body: { paddingHorizontal: spacing[5], paddingBottom: spacing[8], gap: spacing[4] },

  blockedBanner: {
    flexDirection: 'row',
    gap: spacing[2],
    backgroundColor: colors.danger[50],
    borderRadius: radii.lg,
    padding: spacing[3],
    marginTop: spacing[4],
  },
  blockedText: { ...typography.caption, color: '#912018', flex: 1 },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginTop: spacing[4],
    padding: spacing[3],
    borderRadius: radii.lg,
    backgroundColor: colors.ink[50],
  },
  statusLabel: { ...typography.body, color: colors.muted },
  statusValue: { ...typography.bodyStrong, color: colors.ink[900] },

  sectionLabel: {
    ...typography.label,
    color: colors.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    // Extra breathing room ABOVE a new section only; the body's gap supplies
    // the space below it.
    marginTop: spacing[4],
  },

  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
  },
  categoryText: { flex: 1 },
  categoryName: { ...typography.bodyStrong, color: colors.ink[900] },
  categoryMeta: { ...typography.tiny, color: colors.muted, marginTop: 1 },
  changeLink: { ...typography.label, color: colors.primary[700] },

  multiline: { minHeight: 120 },

  // Sits directly under its section label — pulled tight so it reads as part
  // of the heading, not as another field (the body gap would otherwise
  // detach it).
  photoHelper: { ...typography.tiny, color: colors.muted, marginTop: -spacing[3] },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  photoTile: { width: 96 },
  photoImage: { width: 96, height: 96, borderRadius: radii.md, backgroundColor: colors.ink[50] },
  coverTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.scrim,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  coverTagText: { ...typography.tiny, color: colors.white, fontWeight: '600' },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.md,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoOverlayText: { ...typography.tiny, color: colors.white, fontWeight: '600' },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: radii.full,
    backgroundColor: colors.ink[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing[2], marginTop: 4 },
  moveButton: {
    width: 30,
    height: 26,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveButtonOff: { borderColor: colors.surface.border, backgroundColor: colors.ink[50] },
  movePressed: { backgroundColor: colors.primary[100] },
  addPhoto: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoPressed: { backgroundColor: colors.primary[100] },
  addPhotoText: { ...typography.tiny, color: colors.primary[700], fontWeight: '600' },

  segmentRow: { flexDirection: 'row', gap: spacing[2] },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.ink[50],
  },
  segmentActive: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  segmentText: { ...typography.caption, fontWeight: '600', color: colors.ink[700] },
  segmentTextActive: { color: colors.white },
  onRequestNote: { ...typography.caption, color: colors.muted },

  priceRow: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  priceField: { flex: 1 },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
    marginTop: 26, // aligns with the Input's field box under its label
    paddingHorizontal: spacing[3],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    backgroundColor: colors.ink[50],
  },
  currencyText: { ...typography.bodyStrong, color: colors.ink[900] },

  specNumberWrap: {},
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  switchLabel: { ...typography.body, color: colors.ink[900], flex: 1 },
  req: { color: colors.danger.DEFAULT },

  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.DEFAULT,
  },

  sheetScrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheetScrimTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface.DEFAULT,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[5],
    gap: spacing[1],
  },
  tallSheet: { maxHeight: '75%' },
  optionList: { maxHeight: 380 },
  sheetTitle: { ...typography.h3, color: colors.ink[900], marginBottom: spacing[2] },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  sheetRowPressed: { backgroundColor: colors.ink[50] },
  sheetRowText: { ...typography.body, color: colors.ink[900], flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    minHeight: 40,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surface.border,
    paddingHorizontal: spacing[3],
    marginBottom: spacing[2],
  },
  searchInput: { flex: 1, ...typography.body, color: colors.ink[900], paddingVertical: spacing[1] },
});
