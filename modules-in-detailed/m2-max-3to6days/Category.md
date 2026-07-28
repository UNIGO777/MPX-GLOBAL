# MPX Global — B2B Category Tree (v2)

> ## 🔴 Part A overrides (authoritative — supersede this reference doc)
> - **§A14 — "Other" (#40)** is seeded as **two typed sub-categories**: **Other goods** (`type: 'goods'`) and **Other services** (`type: 'service'`). Products map to a leaf as usual and type is derived from the category — the **seller never manually picks goods/service**, and **`resolvedType` is not used**. This supersedes the "Yahan seller khud select karta hai — Goods ya Service" note in §40 below.
> - **§A17 — "Other" has FIXED fields, not free-form.** Other goods / Other services are ordinary categories with a small, **fixed** set of `CategoryAttribute` fields (defined like every other category). **There is NO free-form, seller-defined spec mechanism anywhere in the system** — the earlier "Other" free-form idea is **CANCELLED** (not a future note, not a pending decision). *(⚠️ `Other-category-feilds.png` shows the OLD design — `type=either`, manual goods/service pick, `resolvedType`, free-form specs, a single "General" sub — **all superseded**: "Other" = two typed subs (Other goods / Other services), type from the leaf, no manual pick, no `resolvedType`, fixed `CategoryAttribute` fields.)*
> - **§A11 — Category** gets an optional **`image`** (Cloudinary URL); expected on the 40 tops, optional on subs (with a sensible fallback).
> - **§A12 — `synonyms: [String]`** is **admin-editable** (a tags input on the sub-category create/edit form), not only seeded — otherwise admin-created categories are invisible to synonym search.
> - **§A4** Category uses `active` + `prevActive` (cascade). **§A6** unique, indexed `slug` on Category (and Product, Organisation).
> - **§A16 — `type` lives on the leaf.** `type` (`'goods' | 'service'`) is **required on sub-categories** and **NOT set on the 40 top categories** (`parentId: null` — absent, no default). A top's goods/services grouping is derived from its children at read time, never stored. **Seeding must not set `type` on any top category.**

> Seed taxonomy for the `Category` model (`name`, `slug`, `parentId`, `active`).
> Top category = `parentId: null`. Sub-category = `parentId: <top>`.
> **40 top categories** (39 + Other) · goods + services (services same Product model me treat hote hain).
> **Green/new** = naya top category · **[+NEW]** = existing branch me add hui sub-category.

---

## 1. Agriculture
Seeds & plants · Grains, pulses & cereals · Fresh fruits & vegetables · Spices & herbs · Agricultural machinery & equipment · Fertilizers & soil · Animal feed & fodder · Cattle & livestock supplies · **[+NEW]** Cold chain logistics & storage equipment · **[+NEW]** Smart irrigation & drone farming tech

## 2. Apparel & Garments
Men's clothing · Women's clothing · Kids' & infant wear · Ethnic wear (sarees, kurtis, suits) · Sportswear & activewear · Uniforms & workwear · Undergarments & hosiery · Winter wear

## 3. Textiles, Fabrics & Yarn
Cotton fabric · Silk fabric · Synthetic & blended fabric · Yarn & thread · Home textiles (bedsheets, towels) · Dyed & printed fabric · Denim · Non-woven fabric

## 4. Leather & Leather Products
Finished leather · Leather bags & wallets · Footwear · Leather garments · Belts · Gloves · Leather accessories

## 5. Bags, Luggage & Accessories
Backpacks & school bags · Travel luggage · Handbags & purses · Jute & cotton bags · Promotional bags · Belts & wallets

## 6. Footwear
Men's footwear · Women's footwear · Sports shoes · Safety & industrial shoes · Sandals & slippers · Footwear components

## 7. Food & Beverages
Packaged & processed food · Snacks & confectionery · Beverages (tea, coffee, juices) · Dairy products · Bakery products · Edible oils · Dry fruits & nuts · Organic food

## 8. Chemicals, Dyes & Solvents
Industrial chemicals · Dyes & pigments · Solvents · Adhesives & sealants · Laboratory chemicals · Agrochemicals · Water treatment chemicals · Specialty chemicals · Bio-pesticides · Organic fertilizer chemistry

## 9. Pharmaceuticals & Medical
Pharmaceutical formulations · Ayurvedic & herbal products · Surgical & medical instruments · Hospital furniture & equipment · Diagnostic equipment · Medical disposables · Nutraceuticals & supplements

## 10. Health & Beauty
Cosmetics & makeup · Skincare products · Hair care · Personal hygiene · Essential oils · Herbal & organic beauty · Salon & spa equipment

## 11. Electronics & Electrical
Consumer electronics · Electronic components · LED lights & lighting · Wires & cables · Switches & sockets · Batteries & power supplies · CCTV & security systems · Electrical panels

## 12. Industrial Machinery & Equipment
Manufacturing machines · Packaging machines · Food processing machines · Printing machines · Textile machinery · CNC & machine tools · Material handling equipment · Special purpose machines · Timber/wood processing machinery

## 13. Industrial Supplies
Bearings · Fasteners (nuts, bolts, screws) · Seals & gaskets · Abrasives · Lubricants & oils · Springs · Industrial belts · Hand & power tools

## 14. Mechanical Parts & Spares
Pumps · Valves · Motors · Gears & gearboxes · Compressors · Hydraulic & pneumatic parts · Engine parts

## 15. Automobile Parts & Spares
Two-wheeler parts · Car parts & accessories · Commercial vehicle parts · Tyres & tubes · Auto electricals · Lubricants · Car care & wash equipment

## 16. Building & Construction
TMT bars & steel · Cement & concrete · Bricks & blocks · Tiles & marble (ceramic/granite) · Sanitaryware & fittings · Doors & windows · Paints & coatings · Construction chemicals · Prefab components

## 17. Pipes, Tubes & Fittings
PVC & CPVC pipes · GI & MS pipes · Pipe fittings · Flanges · Hoses · Tubing

## 18. Metals, Minerals & Ores
Iron & steel (casting/fabrication) · Aluminium · Copper & brass · Stainless steel · Minerals & ores · Metal sheets & coils · Scrap metal · **[+NEW]** Precision tools & metal components (export-grade)

## 19. Plastic & PVC
Plastic granules & raw material · Plastic containers & crates · Plastic sheets & films · PVC products · Plastic water tanks · Moulded plastic products

## 20. Rubber & Rubber Products
Rubber sheets · Rubber seals & gaskets · Rubber hoses · Tyres · Rubber components · Latex products

## 21. Packaging Material & Supplies
Corrugated boxes & cartons · PET bottles & jars · Pouches & films · Labels & stickers · Paper bags · Packaging tapes · Bottle caps & closures · Jute/cotton eco-packaging

## 22. Paper & Paper Products
Copier & printing paper · Kraft paper · Paper plates & cups · Tissue paper · Notebooks & registers · Paperboard

## 23. Furniture & Furnishings
Office furniture · Home furniture · Modular furniture · Outdoor furniture · Mattresses · Curtains & upholstery

## 24. Home & Kitchen
Kitchenware & cookware · Home decor · Cleaning supplies · Storage & organizers · Crockery & tableware · Small appliances

## 25. Gems & Jewellery
Gold & silver jewellery · Imitation jewellery · Precious & semi-precious stones · Diamond jewellery · Jewellery-making supplies

## 26. Handicrafts & Decoratives
Handicraft items · Wall decor & paintings · Religious items · Gift articles · Candles & fragrances · Artificial flowers

## 27. Sports, Toys & Games
Sports equipment · Fitness & gym equipment · Toys & games · Outdoor & adventure gear · Musical instruments

## 28. Tools & Hardware
Hand tools · Power tools · Cutting tools · Measuring instruments · Hardware fittings · Welding equipment

## 29. Safety & Security
Personal protective equipment (PPE) · Fire safety · Safety shoes & helmets · Surveillance systems · Access control · **[+NEW]** Industrial PPE & safety gear

## 30. Scientific & Lab Instruments
Laboratory equipment · Testing & measuring instruments · Microscopes · Analytical instruments · Lab glassware

## 31. Electricals — Lighting & Solar
Solar PV panels & systems · Inverters & batteries · Lithium battery storage · LED & lighting fixtures · Street & industrial lighting · Renewable energy equipment · **[+NEW]** Green hydrogen equipment

## 32. Environment & Water
Water treatment plants · RO & purification systems · Pollution control equipment · Waste management · Air filtration

## 33. Office Supplies & Stationery
Stationery items · Printing & promotional products · Office equipment · Files & folders · Writing instruments

## 34. Telecom & Mobile
Mobile phones & accessories · Telecom equipment · Signal boosters · Networking devices · Cables & connectors

## 35. IT, Software & AI Services  *(new)*
Custom AI/ML & Generative AI (LLM) development · Mobile app development (iOS/Android) · Web & e-commerce development · Cloud migration & DevOps (AWS/Azure/GCP) · ERP implementation (SAP/Oracle) · Cybersecurity & data privacy services · Blockchain & Web3 development · Legacy code modernization (COBOL/Java) · Outsourced technical support (L1/L2)

## 36. Finance, Accounting & Business Process Services  *(new)*
Offshore accounting & bookkeeping · Tax preparation & compliance (ATO/IRS etc.) · Fractional CFO & financial advisory · SMSF / pension fund outsourcing · AI-led finance automation (AP/AR) · ISO/GDPR-compliant BPO / back-office teams · Legal process outsourcing (LPO)

## 37. Healthcare & Clinical Services  *(new)*
Clinical data management & R&D outsourcing · Medical device contract manufacturing (as a service) · Telemedicine platform development · Biotech lab outsourcing

## 38. Education, Training & EdTech  *(new)*
Vocational/technical training partnerships · EdTech content & LMS platforms · Professional certification training · Language & communication coaching

## 39. Marketing, Design & Digital Services  *(new)*
Digital marketing & AI personalization · 3D modeling & product prototyping (design service) · Content/creative production

---

## 40. Other  *(catch-all)*
General / uncategorized products or services that don't fit above. 🔴 **Part A §A14/§A17:** "Other" ab do typed sub-categories hain (**Other goods** / **Other services**) — seller manually goods/service **nahi** chunta, type leaf se aata hai. Specs = ek **chhota FIXED `CategoryAttribute` set** (baaki categories jaisa) — **koi free-form key-value nahi**. Baaki sab categories (1-34 goods, 35-39 service) me type automatic aata hai.

## Services treated as products
Categories **35–39** mostly services hain (IT, BPO, clinical, training, marketing). Ye **same `Product` model** me rehti hain — koi alag service entity nahi. In ke liye:
- `unit` = project / hour / month
- price aksar "on request"
- trade fields (HS code, country of origin) optional / N-A
- attributes alag type ke (delivery model, engagement type, team size, tech stack) — goods jaise GSM/material nahi

## Deprioritized (tree me rakhi, abhi low placement/SEO priority)
Gems & Jewellery · Sports, Toys & Games · Handicrafts & Decoratives · Paper & Paper Products · Rubber & Rubber Products · Plastic & PVC · Office Supplies & Stationery · Telecom & Mobile.
Breadth ke liye rakhi — delete nahi; abhi home-page / SEO priority nahi.

## Seeding notes
- Har entry: `name`, `slug` (auto, e.g. "Cotton fabric" → `cotton-fabric`), `parentId` (top = null), `active: true`.
- 🔴 **§A16 — `type` sirf sub-categories pe** (`parentId` set, required). **Top 40 pe `type` set NAHI** (absent, koi default nahi). Top ki goods/service grouping children ke types se **read-time pe derive** hoti hai (mixed top dono me dikhega).
- 🔴 **GAP (seed plan) — `synonyms` for the 40 tops NOT authored yet.** Only 1–2 examples exist in the docs (e.g. Pharmaceuticals → medicine/medicines/pharma/drugs/dawai). A full per-top synonym list must be written before seeding (needed for keyword→category search per A12). **Do NOT invent it** — this is a known open gap.
- Products **sub-category (leaf)** se map hon — cleaner search/filter.
- Category-specific fields ek **`CategoryAttribute`** model se (structured per-category fields, free-form nahi).
- 40 top (incl. Other) + ~250 sub ek starter set; admin CRUD se add/edit/deactivate.