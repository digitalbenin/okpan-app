# Embedding model comparison - import field matching

Sample files: 9 (3 csv, 6 xlsx)
Unique headers: 140

| model | dtype | dimension | query prefix | document prefix | strategy |
| --- | --- | --- | --- | --- | --- |
| Granite R2 97M | q8 | 384 | `(none)` | `(none)` | pipeline |
| Arctic Embed M v2 | q8 | 768 | `query: ` | `(none)` | pipeline |
| EmbeddingGemma 300M q4 | q4 | 768 | `task: search result | query: ` | `title: none | text: ` | sentence_embedding |

## Ground-truth accuracy

117 of 140 headers have an unambiguous expected field. Accuracy is measured against that expectation, not against the other model.

| model | top-1 correct | top-1 | top-3 correct | top-3 |
| --- | --- | --- | --- | --- |
| Granite R2 97M | 42/117 | 35.9% | 66/117 | 56.4% |
| Arctic Embed M v2 | 64/117 | 54.7% | 97/117 | 82.9% |
| EmbeddingGemma 300M q4 | 71/117 | 60.7% | 93/117 | 79.5% |

### Head-to-head on labelled headers

How many models get each header right, so a single model winning is visible.

| models correct | headers |
| --- | --- |
| 3 of 3 | 34 |
| 2 of 3 | 24 |
| 1 of 3 | 27 |
| 0 of 3 | 32 |

Headers only Granite R2 97M gets right (2): Object Name, Sachbegriff

Headers only Arctic Embed M v2 gets right (10): Additional Countries, Begin Date, Date, End Date, Geber, Geo: Country, Ort, Période, Vorbesitzer, d_Place

Headers only EmbeddingGemma 300M q4 gets right (15): Autres numéros, Classification, Culture, Depth IN, Erwerbsart, Erwerbungsart, Maker3 Plus, Numéro d'objet, Numéro de tri, Numéro de tri 2, Obj. Status, Object Number, TIFF, Title, Title1

### Accuracy by header language

| language | headers | Granite R2 97M top-1 | Arctic Embed M v2 top-1 | EmbeddingGemma 300M q4 top-1 |
| --- | --- | --- | --- | --- |
| en | 56 | 22/56 (39.3%) | 31/56 (55.4%) | 35/56 (62.5%) |
| de | 35 | 12/35 (34.3%) | 19/35 (54.3%) | 20/35 (57.1%) |
| fr | 26 | 8/26 (30.8%) | 14/26 (53.8%) | 16/26 (61.5%) |

## Labelled headers where at least one model misses top-1 (83)

| header | expected | Granite R2 97M | Arctic Embed M v2 | EmbeddingGemma 300M q4 |
| --- | --- | --- | --- | --- |
| accession | object id | accession method (miss) 0.918 | accession method (miss) 0.482 | accession method (miss) 0.698 |
| Additional Countries | production place | condition (miss) 0.783 | production place 0.242 | legal status (miss) 0.299 |
| Autres numéros | object id | object count (miss) 0.795 | inscriptions (miss) 0.264 | object id 0.264 |
| Begin Date | date made | accession date (miss) 0.852 | date made 0.314 | date collected (miss) 0.449 |
| Beteiligte | producer | place collected (miss) 0.800 | inscriptions (miss) 0.254 | prior source role (miss) 0.228 |
| Beteiligte // (Name, Sortierung=kleinste) | producer | object id (miss) 0.787 | inscriptions (miss) 0.260 | reign associated name (miss) 0.286 |
| Classification | object type | description (miss) 0.805 | designation (miss) 0.305 | object type 0.453 |
| Classifications | object type | iconography (miss) 0.812 | designation (miss) 0.278 | designation (miss) 0.445 |
| Credit Line | prior source | license (miss) 0.767 | prior source role (miss) 0.195 | weblink (miss) 0.257 |
| Culture | ethnic attribution | condition (miss) 0.819 | material (miss) 0.230 | ethnic attribution 0.339 |
| culture_group | ethnic attribution | department and institution (miss) 0.772 | ethnic attribution 0.181 | ethnic attribution 0.379 |
| d_Description_Name | designation | description (miss) 0.897 | description (miss) 0.390 | description (miss) 0.548 |
| d_Names | producer | reign associated name (miss) 0.779 | reign associated name (miss) 0.189 | designation (miss) 0.427 |
| d_Place | production place | notes (miss) 0.785 | production place 0.359 | place collected (miss) 0.520 |
| d_Place_Historic | production place | notes (miss) 0.823 | place collected (miss) 0.359 | place collected (miss) 0.453 |
| Date | date made | accession date (miss) 0.875 | date made 0.424 | date collected (miss) 0.516 |
| Date d'entrée dans les collections nationales | accession date | accession date 0.820 | accession date 0.397 | date collected (miss) 0.521 |
| Date de début | date made | accession date (miss) 0.845 | accession date (miss) 0.346 | date collected (miss) 0.439 |
| Datierung | date made | date collected (miss) 0.803 | date collected (miss) 0.322 | date collected (miss) 0.476 |
| Depth IN | dimensions | object count (miss) 0.809 | description (miss) 0.276 | dimensions 0.416 |
| Donateur / vendeur / déposant | prior source | producer (miss) 0.850 | producer (miss) 0.291 | designation (miss) 0.269 |
| End Date | date made | accession date (miss) 0.832 | date made 0.328 | date collected (miss) 0.465 |
| Erwerb. Datum | accession date | date collected (miss) 0.842 | accession date 0.412 | accession date 0.542 |
| Erwerb. von | prior source | designation (miss) 0.812 | provenance (miss) 0.307 | provenance (miss) 0.371 |
| Erwerbsart | accession method | license (miss) 0.762 | object type (miss) 0.240 | accession method 0.327 |
| Erwerbungsart | accession method | object type (miss) 0.769 | object type (miss) 0.263 | accession method 0.384 |
| Ethnonyme | ethnic attribution | iconography (miss) 0.773 | ethnic attribution 0.391 | ethnic attribution 0.482 |
| Geber | prior source | date made (miss) 0.741 | prior source 0.217 | object type (miss) 0.294 |
| Geo: City | production place | images (miss) 0.799 | place collected (miss) 0.290 | place collected (miss) 0.342 |
| Geo: Country | production place | condition (miss) 0.786 | production place 0.266 | place collected (miss) 0.350 |
| Geogr. Bezüge | production place | dimensions (miss) 0.768 | place collected (miss) 0.184 | place collected (miss) 0.333 |
| Geogr. Bezüge // Alle | production place | place collected (miss) 0.795 | place collected (miss) 0.239 | place collected (miss) 0.372 |
| height | dimensions | dimensions 0.831 | weight (miss) 0.312 | dimensions 0.435 |
| Height IN | dimensions | designation (miss) 0.776 | dimensions 0.245 | dimensions 0.432 |
| Ident. Nr. | object id | designation (miss) 0.858 | object id 0.316 | object id 0.540 |
| Ident. Nr. // (Sortiernr.) | object id | designation (miss) 0.843 | object id 0.282 | object id 0.465 |
| idno | object id | condition (miss) 0.771 | object id 0.260 | object id 0.387 |
| Kultur/Ethnie | ethnic attribution | event (miss) 0.760 | ethnic attribution 0.398 | ethnic attribution 0.444 |
| length | dimensions | object count (miss) 0.838 | dimensions 0.358 | dimensions 0.462 |
| Liste des noms | producer | inscriptions (miss) 0.785 | reign associated name (miss) 0.258 | reign associated name (miss) 0.374 |
| Local Name | object type | designation (miss) 0.830 | place collected (miss) 0.259 | reign associated name (miss) 0.398 |
| Maker1 | producer | prior source (miss) 0.811 | producer 0.231 | producer 0.434 |
| Maker2 | producer | prior source (miss) 0.794 | producer 0.206 | producer 0.402 |
| Maker3 Plus | producer | prior source (miss) 0.759 | production place (miss) 0.168 | producer 0.340 |
| Multimédias | images | dimensions (miss) 0.748 | images 0.222 | images 0.288 |
| Nom de l'objet | designation | object type (miss) 0.879 | object id (miss) 0.435 | object id (miss) 0.526 |
| Numéro d'objet | object id | object type (miss) 0.870 | object count (miss) 0.476 | object id 0.562 |
| Numéro de collection | object id | object count (miss) 0.821 | date collected (miss) 0.335 | date collected (miss) 0.471 |
| Numéro de gestion | object id | notes (miss) 0.804 | object id 0.189 | object id 0.290 |
| Numéro de tri | object id | iconography (miss) 0.780 | object count (miss) 0.238 | object id 0.273 |
| Numéro de tri 2 | object id | notes (miss) 0.786 | object count (miss) 0.163 | object id 0.260 |
| Obj. Status | display status | object type (miss) 0.887 | legal status (miss) 0.347 | display status 0.503 |
| Object Name | object type | object type 0.901 | object id (miss) 0.420 | object id (miss) 0.626 |
| Object Number | object id | object count (miss) 0.922 | object count (miss) 0.476 | object id 0.661 |
| Object Sort Number | object id | object count (miss) 0.879 | object count (miss) 0.421 | object count (miss) 0.568 |
| Objektname | designation | object type (miss) 0.894 | object id (miss) 0.397 | object id (miss) 0.525 |
| Objektnummer | object id | object count (miss) 0.892 | object id 0.421 | object id 0.604 |
| Ort | production place | event (miss) 0.758 | production place 0.306 | place collected (miss) 0.300 |
| period | date made | condition (miss) 0.805 | material (miss) 0.322 | condition (miss) 0.282 |
| Période | date made | date collected (miss) 0.786 | date made 0.323 | condition (miss) 0.200 |
| Primary Country | production place | prior source (miss) 0.835 | prior source (miss) 0.226 | ethnic attribution (miss) 0.295 |
| Primary Rendition No | object id | prior source (miss) 0.813 | prior source (miss) 0.231 | provenance (miss) 0.348 |
| Reference_Numbers | object id | notes (miss) 0.842 | bibliography (miss) 0.332 | bibliography (miss) 0.436 |
| Références publiées | bibliography | notes (miss) 0.811 | bibliography 0.354 | bibliography 0.527 |
| Rôle | prior source role | provenance (miss) 0.780 | prior source role 0.367 | prior source role 0.433 |
| Sachbegriff | object type | object type 0.801 | bibliography (miss) 0.270 | designation (miss) 0.300 |
| Sammler | prior source | place collected (miss) 0.797 | place collected (miss) 0.297 | place collected (miss) 0.322 |
| Sammlung | department and institution | place collected (miss) 0.795 | place collected (miss) 0.316 | place collected (miss) 0.512 |
| Staat | production place | department and institution (miss) 0.767 | legal status (miss) 0.293 | legal status (miss) 0.366 |
| Statut de l'objet | display status | object type (miss) 0.851 | object type (miss) 0.349 | object type (miss) 0.516 |
| Texte Online | weblink | material (miss) 0.757 | weblink 0.231 | weblink 0.406 |
| TIFF | images | production place (miss) 0.788 | production place (miss) 0.194 | images 0.294 |
| Titel | designation | designation 0.789 | description (miss) 0.268 | designation 0.361 |
| Title | designation | description (miss) 0.839 | description (miss) 0.230 | designation 0.396 |
| Title1 | designation | description (miss) 0.824 | description (miss) 0.215 | designation 0.348 |
| Title2 | designation | designation 0.819 | description (miss) 0.224 | designation 0.342 |
| Title3 | designation | designation 0.807 | designation 0.203 | legal status (miss) 0.337 |
| Toponyme | production place | iconography (miss) 0.793 | place collected (miss) 0.324 | designation (miss) 0.344 |
| Veräußerer | prior source | condition (miss) 0.773 | producer (miss) 0.278 | producer (miss) 0.297 |
| Vorbesitzer | prior source | designation (miss) 0.749 | prior source 0.264 | provenance (miss) 0.388 |
| width | dimensions | dimensions 0.816 | weight (miss) 0.338 | dimensions 0.526 |
| Width IN | dimensions | designation (miss) 0.782 | dimensions 0.304 | dimensions 0.501 |
| year | date made | accession date (miss) 0.825 | date collected (miss) 0.286 | accession date (miss) 0.368 |

## Pairwise agreement on top-1

| pair | identical top-1 | first model top-1 in other top-3 |
| --- | --- | --- |
| Granite R2 97M vs Arctic Embed M v2 | 58 (41.4%) | 87 (62.1%) |
| Granite R2 97M vs EmbeddingGemma 300M q4 | 56 (40.0%) | 92 (65.7%) |
| Arctic Embed M v2 vs EmbeddingGemma 300M q4 | 81 (57.9%) | 112 (80.0%) |

## Score distributions (top-1 per header)

| model | min | p25 | median | p75 | max |
| --- | --- | --- | --- | --- | --- |
| Granite R2 97M | 0.741 | 0.787 | 0.817 | 0.850 | 1.000 |
| Arctic Embed M v2 | 0.138 | 0.245 | 0.301 | 0.390 | 0.612 |
| EmbeddingGemma 300M q4 | 0.200 | 0.340 | 0.426 | 0.527 | 0.794 |

## Calibration: threshold and confidence bands

Derived from the labelled headers above, so the app can use fixed values.
A match is a suggestion whose similarity clears the threshold; the app
then applies top-1 automatically and lists up to 3.

### Granite R2 97M

| signal | p10 | p25 | median | p75 | p90 |
| --- | --- | --- | --- | --- | --- |
| correct matches | 0.732 | 0.757 | 0.799 | 0.836 | 0.900 |
| best incorrect match | 0.767 | 0.785 | 0.810 | 0.834 | 0.871 |

| threshold | precision | recall | F1 |
| --- | --- | --- | --- |
| 0.10 | 0.188 | 0.564 | 0.282 |
| 0.15 | 0.188 | 0.564 | 0.282 |
| 0.20 | 0.188 | 0.564 | 0.282 |
| 0.25 | 0.188 | 0.564 | 0.282 |
| 0.30 | 0.188 | 0.564 | 0.282 |
| 0.35 | 0.188 | 0.564 | 0.282 |
| 0.40 | 0.188 | 0.564 | 0.282 |
| 0.45 | 0.188 | 0.564 | 0.282 |
| 0.50 | 0.188 | 0.564 | 0.282 |
| 0.55 | 0.188 | 0.564 | 0.282 |
| 0.60 | 0.188 | 0.564 | 0.282 |
| 0.65 | 0.188 | 0.564 | 0.282 |
| 0.70 | 0.188 | 0.564 | 0.282 |

Best F1 at threshold **0.10** (precision 0.188, recall 0.564, F1 0.282).

Recommended constants: threshold `0.10`, confidence bands high `0.84`, medium `0.80`, low `0.10`.

### Arctic Embed M v2

| signal | p10 | p25 | median | p75 | p90 |
| --- | --- | --- | --- | --- | --- |
| correct matches | 0.183 | 0.217 | 0.276 | 0.389 | 0.472 |
| best incorrect match | 0.194 | 0.234 | 0.274 | 0.329 | 0.392 |

| threshold | precision | recall | F1 |
| --- | --- | --- | --- |
| 0.10 | 0.276 | 0.829 | 0.415 |
| 0.15 | 0.277 | 0.821 | 0.415 |
| 0.20 | 0.298 | 0.752 | 0.427 |
| 0.25 | 0.330 | 0.581 | 0.421 |
| 0.30 | 0.425 | 0.436 | 0.430 |
| 0.35 | 0.528 | 0.325 | 0.402 |
| 0.40 | 0.719 | 0.197 | 0.309 |
| 0.45 | 0.765 | 0.111 | 0.194 |
| 0.50 | 1.000 | 0.085 | 0.157 |
| 0.55 | 1.000 | 0.043 | 0.082 |
| 0.60 | 1.000 | 0.009 | 0.017 |
| 0.65 | 1.000 | 0.000 | 0.000 |
| 0.70 | 1.000 | 0.000 | 0.000 |

Best F1 at threshold **0.26** (precision 0.358, recall 0.547, F1 0.432).

Recommended constants: threshold `0.26`, confidence bands high `0.39`, medium `0.28`, low `0.26`.

### EmbeddingGemma 300M q4

| signal | p10 | p25 | median | p75 | p90 |
| --- | --- | --- | --- | --- | --- |
| correct matches | 0.209 | 0.294 | 0.419 | 0.540 | 0.624 |
| best incorrect match | 0.270 | 0.316 | 0.364 | 0.444 | 0.516 |

| threshold | precision | recall | F1 |
| --- | --- | --- | --- |
| 0.10 | 0.265 | 0.795 | 0.397 |
| 0.15 | 0.265 | 0.795 | 0.397 |
| 0.20 | 0.268 | 0.795 | 0.401 |
| 0.25 | 0.287 | 0.795 | 0.422 |
| 0.30 | 0.327 | 0.718 | 0.449 |
| 0.35 | 0.408 | 0.624 | 0.493 |
| 0.40 | 0.477 | 0.530 | 0.502 |
| 0.45 | 0.536 | 0.385 | 0.448 |
| 0.50 | 0.638 | 0.316 | 0.423 |
| 0.55 | 0.806 | 0.214 | 0.338 |
| 0.60 | 0.833 | 0.128 | 0.222 |
| 0.65 | 0.833 | 0.085 | 0.155 |
| 0.70 | 1.000 | 0.051 | 0.098 |

Best F1 at threshold **0.38** (precision 0.463, recall 0.581, F1 0.515).

Recommended constants: threshold `0.38`, confidence bands high `0.54`, medium `0.42`, low `0.38`.

## Per-file: top-1 for every header

### 2021.06.09 SMB-SPK Benin Data.xlsx

| header | Granite R2 97M top-1 | Arctic Embed M v2 top-1 | EmbeddingGemma 300M q4 top-1 |
| --- | --- | --- | --- |
| Ident. Nr. // (Sortiernr.) | designation 0.843 (miss) | object id 0.282 | object id 0.465 |
| Datierung | date collected 0.803 (miss) | date collected 0.322 (miss) | date collected 0.476 (miss) |
| Objekttyp | object type 0.911 | object type 0.537 | object type 0.670 |
| Anzahl Teile | object count 0.822 | object count 0.383 | object count 0.467 |
| Besitzart | condition 0.755 | description 0.149 | object type 0.369 |
| Beteiligte | place collected 0.800 (miss) | inscriptions 0.254 (miss) | prior source role 0.228 (miss) |
| Beteiligte // (Name, Sortierung=kleinste) | object id 0.787 (miss) | inscriptions 0.260 (miss) | reign associated name 0.286 (miss) |
| Digital Assets | images 0.798 | images 0.251 | images 0.332 |
| Erwerb. Datum | date collected 0.842 (miss) | accession date 0.412 | accession date 0.542 |
| Erwerb. Notiz | notes 0.821 | notes 0.306 | notes 0.499 |
| Erwerb. Nr. | designation 0.802 | accession date 0.249 | accession date 0.425 |
| Erwerbungsart | object type 0.769 (miss) | object type 0.263 (miss) | accession method 0.384 |
| Erwerb. von | designation 0.812 (miss) | provenance 0.307 (miss) | provenance 0.371 (miss) |
| Geogr. Bezüge | dimensions 0.768 (miss) | place collected 0.184 (miss) | place collected 0.333 (miss) |
| Geogr. Bezüge // Alle | place collected 0.795 (miss) | place collected 0.239 (miss) | place collected 0.372 (miss) |
| ID | object id 0.894 | object id 0.333 | object id 0.530 |
| Ident. Nr. | designation 0.858 (miss) | object id 0.316 | object id 0.540 |
| Maße | dimensions 0.784 | dimensions 0.439 | dimensions 0.531 |
| Material / Technik | material 0.890 | material 0.482 | material 0.599 |
| Material / Technik // Alle | material 0.876 | material 0.466 | material 0.604 |
| Obj. Status | object type 0.887 (miss) | legal status 0.347 (miss) | display status 0.503 |
| Objektref. | object type 0.830 | object id 0.427 | object id 0.512 |
| Sachbegr. Ausgabe | notes 0.794 | bibliography 0.212 | designation 0.345 |
| Sachbegriff | object type 0.801 | bibliography 0.270 (miss) | designation 0.300 (miss) |
| Standardbild | images 0.842 | images 0.284 | images 0.435 |
| Texte Online | material 0.757 (miss) | weblink 0.231 | weblink 0.406 |
| Titel | designation 0.789 | description 0.268 (miss) | designation 0.361 |
| Veräußerer | condition 0.773 (miss) | producer 0.278 (miss) | producer 0.297 (miss) |
| Verw. Institution | department and institution 0.854 | department and institution 0.429 | department and institution 0.555 |
| Zuständigkeiten | condition 0.811 | designation 0.279 | department and institution 0.308 |

### BeninDigital_MQB.xlsx

| header | Granite R2 97M top-1 | Arctic Embed M v2 top-1 | EmbeddingGemma 300M q4 top-1 |
| --- | --- | --- | --- |
| Multimédias | dimensions 0.748 (miss) | images 0.222 | images 0.288 |
| ObjectID | object id 0.944 | object id 0.511 | object id 0.630 |
| Unité patrimoniale | department and institution 0.798 | place collected 0.230 | provenance 0.226 |
| ObjectID | object id 0.944 | object id 0.511 | object id 0.630 |
| Numéro de collection | object count 0.821 (miss) | date collected 0.335 (miss) | date collected 0.471 (miss) |
| Numéro d'objet | object type 0.870 (miss) | object count 0.476 (miss) | object id 0.562 |
| Numéro de gestion | notes 0.804 (miss) | object id 0.189 | object id 0.290 |
| Numéro de tri | iconography 0.780 (miss) | object count 0.238 (miss) | object id 0.273 |
| Unité patrimoniale | department and institution 0.798 | place collected 0.230 | provenance 0.226 |
| Classifications | iconography 0.812 (miss) | designation 0.278 (miss) | designation 0.445 (miss) |
| Mode d'entrée | accession method 0.821 | accession method 0.246 | accession method 0.352 |
| Rôle | provenance 0.780 (miss) | prior source role 0.367 | prior source role 0.433 |
| Donateur / vendeur / déposant | producer 0.850 (miss) | producer 0.291 (miss) | designation 0.269 (miss) |
| Liste des noms | inscriptions 0.785 (miss) | reign associated name 0.258 (miss) | reign associated name 0.374 (miss) |
| Tri titres | designation 0.776 | inscriptions 0.138 | bibliography 0.248 |
| Période | date collected 0.786 (miss) | date made 0.323 | condition 0.200 (miss) |
| Nom de l'objet | object type 0.879 (miss) | object id 0.435 (miss) | object id 0.526 (miss) |
| Date | accession date 0.875 (miss) | date made 0.424 | date collected 0.516 (miss) |
| Date de début | accession date 0.845 (miss) | accession date 0.346 (miss) | date collected 0.439 (miss) |
| Matériaux et techniques | material 0.827 | material 0.389 | material 0.551 |
| Dimensions | dimensions 0.932 | dimensions 0.507 | dimensions 0.730 |
| Description | description 0.941 | description 0.397 | description 0.620 |
| Usage | inscriptions 0.849 | license 0.284 | description 0.362 |
| Toponyme | iconography 0.793 (miss) | place collected 0.324 (miss) | designation 0.344 (miss) |
| Nbre toponymes | notes 0.762 | place collected 0.223 | reign associated name 0.310 |
| Ethnonyme | iconography 0.773 (miss) | ethnic attribution 0.391 | ethnic attribution 0.482 |
| Nbre ethnonymes | notes 0.769 | ethnic attribution 0.291 | ethnic attribution 0.367 |
| Culture | condition 0.819 (miss) | material 0.230 (miss) | ethnic attribution 0.339 |
| Autres numéros | object count 0.795 (miss) | inscriptions 0.264 (miss) | object id 0.264 |
| Numéro de tri 2 | notes 0.786 (miss) | object count 0.163 (miss) | object id 0.260 |
| Nombre_elements | object count 0.813 | object count 0.276 | object count 0.375 |
| Multiple | designation 0.799 | place collected 0.241 | object count 0.348 |
| Provenance historique | provenance 0.833 | provenance 0.480 | provenance 0.598 |
| Références publiées | notes 0.811 (miss) | bibliography 0.354 | bibliography 0.527 |
| Bibliographie | bibliography 0.933 | bibliography 0.584 | bibliography 0.632 |
| Notes | notes 0.876 | notes 0.446 | notes 0.683 |
| Remarques du conservateur | notes 0.755 | notes 0.220 | notes 0.329 |
| Statut de l'objet | object type 0.851 (miss) | object type 0.349 (miss) | object type 0.516 (miss) |
| Date d'entrée dans les collections nationales | accession date 0.820 | accession date 0.397 | date collected 0.521 (miss) |
| Crédits photographiques | images 0.841 | images 0.323 | images 0.357 |

### ÜM-Benin.xlsx

| header | Granite R2 97M top-1 | Arctic Embed M v2 top-1 | EmbeddingGemma 300M q4 top-1 |
| --- | --- | --- | --- |
| Objektnummer | object count 0.892 (miss) | object id 0.421 | object id 0.604 |
| Objektname | object type 0.894 (miss) | object id 0.397 (miss) | object id 0.525 (miss) |
| Kultur/Ethnie | event 0.760 (miss) | ethnic attribution 0.398 | ethnic attribution 0.444 |
| Staat | department and institution 0.767 (miss) | legal status 0.293 (miss) | legal status 0.366 (miss) |
| Ort | event 0.758 (miss) | production place 0.306 | place collected 0.300 (miss) |
| Maße | dimensions 0.784 | dimensions 0.439 | dimensions 0.531 |
| Material | material 0.961 | material 0.526 | material 0.689 |
| Datierung | date collected 0.803 (miss) | date collected 0.322 (miss) | date collected 0.476 (miss) |
| Sammlung | place collected 0.795 (miss) | place collected 0.316 (miss) | place collected 0.512 (miss) |
| Geber | date made 0.741 (miss) | prior source 0.217 | object type 0.294 (miss) |
| Vorbesitzer | designation 0.749 (miss) | prior source 0.264 | provenance 0.388 (miss) |
| Sammler | place collected 0.797 (miss) | place collected 0.297 (miss) | place collected 0.322 (miss) |
| Erwerbsdatum | accession date 0.835 | accession date 0.373 | accession date 0.540 |
| Erwerbsart | license 0.762 (miss) | object type 0.240 (miss) | accession method 0.327 |
| Beschreibung - siehe Word-Dokument | description 0.843 | description 0.426 | description 0.541 |

### csv_simple.csv

| header | Granite R2 97M top-1 | Arctic Embed M v2 top-1 | EmbeddingGemma 300M q4 top-1 |
| --- | --- | --- | --- |
| Index | notes 0.837 | description 0.238 | bibliography 0.418 |
| "Eruption length (mins)" | inscriptions 0.788 | dimensions 0.228 | production technique 0.232 |
| Eruption wait (mins) | event 0.785 | accession date 0.209 | date made 0.268 |

### pres\Benin_MCR_Met_July_1_2021.csv

| header | Granite R2 97M top-1 | Arctic Embed M v2 top-1 | EmbeddingGemma 300M q4 top-1 |
| --- | --- | --- | --- |
| Primary Rendition No | prior source 0.813 (miss) | prior source 0.231 (miss) | provenance 0.348 (miss) |
| Object Number | object count 0.922 (miss) | object count 0.476 (miss) | object id 0.661 |
| Object Sort Number | object count 0.879 (miss) | object count 0.421 (miss) | object count 0.568 (miss) |
| Classification | description 0.805 (miss) | designation 0.305 (miss) | object type 0.453 |
| Title | description 0.839 (miss) | description 0.230 (miss) | designation 0.396 |
| Culture | condition 0.819 (miss) | material 0.230 (miss) | ethnic attribution 0.339 |
| Dynasty | reign associated name 0.809 | reign associated name 0.278 | reign associated name 0.441 |
| Date | accession date 0.875 (miss) | date made 0.424 | date collected 0.516 (miss) |
| Medium | material 0.831 | material 0.265 | material 0.340 |
| Dimensions | dimensions 0.932 | dimensions 0.507 | dimensions 0.730 |
| Credit Line | license 0.767 (miss) | prior source role 0.195 (miss) | weblink 0.257 (miss) |
| Geo: City | images 0.799 (miss) | place collected 0.290 (miss) | place collected 0.342 (miss) |
| Geo: Country | condition 0.786 (miss) | production place 0.266 | place collected 0.350 (miss) |

### pres\TMS_Digital-Benin.xlsx

| header | Granite R2 97M top-1 | Arctic Embed M v2 top-1 | EmbeddingGemma 300M q4 top-1 |
| --- | --- | --- | --- |
| TIFF | production place 0.788 (miss) | production place 0.194 (miss) | images 0.294 |
| Img | images 0.900 | images 0.290 | images 0.558 |
| Object Number | object count 0.922 (miss) | object count 0.476 (miss) | object id 0.661 |
| Maker1 | prior source 0.811 (miss) | producer 0.231 | producer 0.434 |
| Maker2 | prior source 0.794 (miss) | producer 0.206 | producer 0.402 |
| Maker3 Plus | prior source 0.759 (miss) | production place 0.168 (miss) | producer 0.340 |
| Classification | description 0.805 (miss) | designation 0.305 (miss) | object type 0.453 |
| Date | accession date 0.875 (miss) | date made 0.424 | date collected 0.516 (miss) |
| Begin Date | accession date 0.852 (miss) | date made 0.314 | date collected 0.449 (miss) |
| End Date | accession date 0.832 (miss) | date made 0.328 | date collected 0.465 (miss) |
| Title1 | description 0.824 (miss) | description 0.215 (miss) | designation 0.348 |
| Title2 | designation 0.819 | description 0.224 (miss) | designation 0.342 |
| Title3 | designation 0.807 | designation 0.203 | legal status 0.337 (miss) |
| Object Name | object type 0.901 | object id 0.420 (miss) | object id 0.626 (miss) |
| Local Name | designation 0.830 (miss) | place collected 0.259 (miss) | reign associated name 0.398 (miss) |
| Pattern Name | designation 0.814 | reign associated name 0.331 | designation 0.420 |
| Dimensions | dimensions 0.932 | dimensions 0.507 | dimensions 0.730 |
| Height IN | designation 0.776 (miss) | dimensions 0.245 | dimensions 0.432 |
| Width IN | designation 0.782 (miss) | dimensions 0.304 | dimensions 0.501 |
| Depth IN | object count 0.809 (miss) | description 0.276 (miss) | dimensions 0.416 |
| Medium | material 0.831 | material 0.265 | material 0.340 |
| Credit Line | license 0.767 (miss) | prior source role 0.195 (miss) | weblink 0.257 (miss) |
| Primary Country | prior source 0.835 (miss) | prior source 0.226 (miss) | ethnic attribution 0.295 (miss) |
| Additional Countries | condition 0.783 (miss) | production place 0.242 | legal status 0.299 (miss) |
| Object Type | object type 0.978 | object type 0.579 | object type 0.794 |
| Status Flags | display status 0.870 | display status 0.387 | display status 0.543 |
| Photography Credit | images 0.804 | images 0.274 | images 0.384 |

### pres\longtext.csv

| header | Granite R2 97M top-1 | Arctic Embed M v2 top-1 | EmbeddingGemma 300M q4 top-1 |
| --- | --- | --- | --- |
| Primary Rendition No | prior source 0.813 (miss) | prior source 0.231 (miss) | provenance 0.348 (miss) |
| Object Number | object count 0.922 (miss) | object count 0.476 (miss) | object id 0.661 |
| Object Sort Number | object count 0.879 (miss) | object count 0.421 (miss) | object count 0.568 (miss) |
| Classification | description 0.805 (miss) | designation 0.305 (miss) | object type 0.453 |
| Title | description 0.839 (miss) | description 0.230 (miss) | designation 0.396 |
| Culture | condition 0.819 (miss) | material 0.230 (miss) | ethnic attribution 0.339 |
| Dynasty | reign associated name 0.809 | reign associated name 0.278 | reign associated name 0.441 |
| Date | accession date 0.875 (miss) | date made 0.424 | date collected 0.516 (miss) |
| Medium | material 0.831 | material 0.265 | material 0.340 |
| Dimensions | dimensions 0.932 | dimensions 0.507 | dimensions 0.730 |
| Credit Line | license 0.767 (miss) | prior source role 0.195 (miss) | weblink 0.257 (miss) |
| Geo: City | images 0.799 (miss) | place collected 0.290 (miss) | place collected 0.342 (miss) |
| Geo: Country | condition 0.786 (miss) | production place 0.266 | place collected 0.350 (miss) |

### pres\templates\MAA Benin City for Digital Benin.xlsx

| header | Granite R2 97M top-1 | Arctic Embed M v2 top-1 | EmbeddingGemma 300M q4 top-1 |
| --- | --- | --- | --- |
| idno | condition 0.771 (miss) | object id 0.260 | object id 0.387 |
| prefix | designation 0.841 | prior source 0.298 | designation 0.334 |
| year | accession date 0.825 (miss) | date collected 0.286 (miss) | accession date 0.368 (miss) |
| accession | accession method 0.918 (miss) | accession method 0.482 (miss) | accession method 0.698 (miss) |
| suffix | designation 0.832 | description 0.306 | designation 0.289 |
| Reference_Numbers | notes 0.842 (miss) | bibliography 0.332 (miss) | bibliography 0.436 (miss) |
| d_Names | reign associated name 0.779 (miss) | reign associated name 0.189 (miss) | designation 0.427 (miss) |
| d_Description_Name | description 0.897 (miss) | description 0.390 (miss) | description 0.548 (miss) |
| maker | producer 0.836 | producer 0.333 | producer 0.473 |
| local | place collected 0.813 | place collected 0.267 | place collected 0.393 |
| d_Place | notes 0.785 (miss) | production place 0.359 | place collected 0.520 (miss) |
| d_Place_Historic | notes 0.823 (miss) | place collected 0.359 (miss) | place collected 0.453 (miss) |
| culture_group | department and institution 0.772 (miss) | ethnic attribution 0.181 | ethnic attribution 0.379 |
| period | condition 0.805 (miss) | material 0.322 (miss) | condition 0.282 (miss) |
| date_made | date made 0.871 | date made 0.589 | date made 0.772 |
| source | prior source 0.900 | prior source 0.441 | prior source 0.580 |
| source_date | prior source 0.866 | date made 0.382 | prior source 0.530 |
| Collection or Excavation Year | date collected 0.861 | date collected 0.400 | date collected 0.566 |
| dimensions | dimensions 1.000 | dimensions 0.531 | dimensions 0.755 |
| length | object count 0.838 (miss) | dimensions 0.358 | dimensions 0.462 |
| height | dimensions 0.831 | weight 0.312 (miss) | dimensions 0.435 |
| width | dimensions 0.816 | weight 0.338 (miss) | dimensions 0.526 |
| weight | weight 1.000 | weight 0.585 | weight 0.756 |
| material | material 1.000 | material 0.612 | material 0.720 |
| keyword | condition 0.817 | designation 0.224 | designation 0.337 |

### pres\templates\MAA Digital Benin Data 20211208 (1).xlsx

| header | Granite R2 97M top-1 | Arctic Embed M v2 top-1 | EmbeddingGemma 300M q4 top-1 |
| --- | --- | --- | --- |
| idno | condition 0.771 (miss) | object id 0.260 | object id 0.387 |
| Reference_Numbers | notes 0.842 (miss) | bibliography 0.332 (miss) | bibliography 0.436 (miss) |
| local | place collected 0.813 | place collected 0.267 | place collected 0.393 |
| d_Description_Name | description 0.897 (miss) | description 0.390 (miss) | description 0.548 (miss) |
| d_Place | notes 0.785 (miss) | production place 0.359 | place collected 0.520 (miss) |
| culture_group | department and institution 0.772 (miss) | ethnic attribution 0.181 | ethnic attribution 0.379 |
| maker | producer 0.836 | producer 0.333 | producer 0.473 |
| period | condition 0.805 (miss) | material 0.322 (miss) | condition 0.282 (miss) |
| source | prior source 0.900 | prior source 0.441 | prior source 0.580 |
| source_date | prior source 0.866 | date made 0.382 | prior source 0.530 |
| Collection or Excavation Year | date collected 0.861 | date collected 0.400 | date collected 0.566 |
| height | dimensions 0.831 | weight 0.312 (miss) | dimensions 0.435 |
| length | object count 0.838 (miss) | dimensions 0.358 | dimensions 0.462 |
| width | dimensions 0.816 | weight 0.338 (miss) | dimensions 0.526 |
| weight | weight 1.000 | weight 0.585 | weight 0.756 |
