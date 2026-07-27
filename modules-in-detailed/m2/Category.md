# MPX Global — B2B Category Tree (IndiaMART-style, 2 levels)

> Seed taxonomy for the `Category` model (`name`, `slug`, `parentId`, `active`).
> Top category = `parentId: null`. Sub-category = `parentId: <top>`.
> IndiaMART ke actual me 1 lakh+ leaf categories hain — ye ek practical starter tree hai, baad me extend/edit kar sakte ho (admin CRUD se).

---

## 1. Agriculture
Seeds & plants · Grains, pulses & cereals · Fresh fruits & vegetables · Spices & herbs · Agricultural machinery & equipment · Fertilizers & soil · Animal feed & fodder · Cattle & livestock supplies

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
Industrial chemicals · Dyes & pigments · Solvents · Adhesives & sealants · Laboratory chemicals · Agrochemicals · Water treatment chemicals · Specialty chemicals

## 9. Pharmaceuticals & Medical
Pharmaceutical formulations · Ayurvedic & herbal products · Surgical & medical instruments · Hospital furniture & equipment · Diagnostic equipment · Medical disposables · Nutraceuticals & supplements

## 10. Health & Beauty
Cosmetics & makeup · Skincare products · Hair care · Personal hygiene · Essential oils · Herbal & organic beauty · Salon & spa equipment

## 11. Electronics & Electrical
Consumer electronics · Electronic components · LED lights & lighting · Wires & cables · Switches & sockets · Batteries & power supplies · CCTV & security systems · Electrical panels

## 12. Industrial Machinery & Equipment
Manufacturing machines · Packaging machines · Food processing machines · Printing machines · Textile machinery · CNC & machine tools · Material handling equipment · Special purpose machines

## 13. Industrial Supplies
Bearings · Fasteners (nuts, bolts, screws) · Seals & gaskets · Abrasives · Lubricants & oils · Springs · Industrial belts · Hand & power tools

## 14. Mechanical Parts & Spares
Pumps · Valves · Motors · Gears & gearboxes · Compressors · Hydraulic & pneumatic parts · Engine parts

## 15. Automobile Parts & Spares
Two-wheeler parts · Car parts & accessories · Commercial vehicle parts · Tyres & tubes · Auto electricals · Lubricants · Car care & wash equipment

## 16. Building & Construction
TMT bars & steel · Cement & concrete · Bricks & blocks · Tiles & marble · Sanitaryware & fittings · Doors & windows · Paints & coatings · Construction chemicals

## 17. Pipes, Tubes & Fittings
PVC & CPVC pipes · GI & MS pipes · Pipe fittings · Flanges · Hoses · Tubing

## 18. Metals, Minerals & Ores
Iron & steel · Aluminium · Copper & brass · Stainless steel · Minerals & ores · Metal sheets & coils · Scrap metal

## 19. Plastic & PVC
Plastic granules & raw material · Plastic containers & crates · Plastic sheets & films · PVC products · Plastic water tanks · Moulded plastic products

## 20. Rubber & Rubber Products
Rubber sheets · Rubber seals & gaskets · Rubber hoses · Tyres · Rubber components · Latex products

## 21. Packaging Material & Supplies
Corrugated boxes & cartons · PET bottles & jars · Pouches & films · Labels & stickers · Paper bags · Packaging tapes · Bottle caps & closures

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
Personal protective equipment (PPE) · Fire safety · Safety shoes & helmets · Surveillance systems · Access control · Industrial safety

## 30. Scientific & Lab Instruments
Laboratory equipment · Testing & measuring instruments · Microscopes · Analytical instruments · Lab glassware

## 31. Electricals — Lighting & Solar
Solar panels & systems · Inverters & batteries · LED & lighting fixtures · Street & industrial lighting · Renewable energy equipment

## 32. Environment & Water
Water treatment plants · RO & purification systems · Pollution control equipment · Waste management · Air filtration

## 33. Office Supplies & Stationery
Stationery items · Printing & promotional products · Office equipment · Files & folders · Writing instruments

## 34. Telecom & Mobile
Mobile phones & accessories · Telecom equipment · Signal boosters · Networking devices · Cables & connectors

---

### Seeding notes
- Har entry ke liye: `name`, `slug` (name se auto, e.g. "Cotton fabric" → `cotton-fabric`), `parentId` (top ke liye null), `active: true`.
- Products **leaf/sub-category** se map hone chahiye (top se nahi) — cleaner search/filter.
- Ye 34 top + ~230 sub ek starter set hai; admin CRUD se add/edit/deactivate ho sakta hai.