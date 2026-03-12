# Piano di Test Beta: Sincronizzazione P2P Offline-First

Questo documento contiene un piano di test esaustivo per verificare la robustezza, la stabilità e la consistenza della funzionalità di sincronizzazione P2P collaborativa del database. È essenziale per scovare le edge case nella gestione del CRDT (Conflict-free Replicated Data Type) e della persistenza SQLite locali.

Tutti i test dovrebbero essere eseguiti idealmente con almeno due istanze dell'applicazione (es. su due PC diversi, o due macchine virtuali) denominate **Peer A** e **Peer B**.

---

## 1. Connettività Base e Real-Time (Scenario Principale)
**Obiettivo:** Verificare lo strato di trasporto (WebRTC/Trystero) e l'interfaccia utente.

*   [ ] **Test di Rilevamento Presenza:** Connettere Peer A e poi Peer B allo stesso progetto (tramite password/accesso). Verificare che l'icona utente / stato della sincronizzazione in alto si aggiorni immediatamente indicando 2 peer connessi.
*   [ ] **Creazione Semplice:** Peer A crea una nuova Entità (es. un Institution o un Object). Verificarne l'apparizione istantanea sullo schermo del Peer B senza ricaricare la pagina.
*   [ ] **Modifica Semplice:** Peer B modifica il nome o la descrizione dell'entità appena creata. Peer A deve vedere il campo testuale aggiornarsi o aggiornarsi istantaneamente dopo aver tolto il focus dal campo.
*   [ ] **Cancellazione Semplice:** Peer A elimina un'entità. Peer B deve vedere scomparire l'entità istantaneamente.

---

## 2. Test Offline-First & Resincronizzazione
**Obiettivo:** Assicurare che il lavoro fatto senza internet o connessioni locali venga ritrasmesso in maniera affidabile al momento della riconnessione.

*   [ ] **Lavoro Singolo Offline:** 
    1. A e B sono sincronizzati. 
    2. Peer B va intenzionalmente *offline* (disabilita il Wi-Fi o si scollega dalla rete locale).
    3. Peer B continua a lavorare, creando 3 nuovi oggetti e modificandone 1 esistente.
    4. Peer B torna online. 
    5. Peer A deve ricevere tutti i 3 nuovi oggetti e la modifica non appena avviene il ripristino della connettività.
*   [ ] **Avvio da Freddo (Hydration):** 
    1. Peer A avvia il progetto ma Peer B è spento.
    2. Peer A effettua molto lavoro nel progetto. Poi spegne l'app.
    3. Peer A riavvia l'app (verifica caricamento da DB SQLite `snapshot-hydrate`).
    4. Peer B accende e accede. Entrambi devono essere perfettamente speculari.
*   [ ] **Coda Offline con Ordine Dipendente:**
    1. Peer A e Peer B sono sincronizzati, poi Peer B va offline.
    2. Su Peer B creare in sequenza una Institution, poi una Datasource collegata, poi un Object collegato alla stessa Institution, poi un link `objects_datasources` tra Object e Datasource.
    3. Tornare online.
    4. *Risultato Atteso:* Tutte le entità devono comparire sul Peer A senza errori di ordine applicativo, senza record orfani e senza `FOREIGN KEY constraint failed` nei log.

---

## 3. Gestione Conflitti e Modifiche Concorrenti
**Obiettivo:** Accertarsi dello stato di convergenza del database quando la divergenza è simultanea.

*   [ ] **Conflitto su Singolo Campo:**
    1. Peer A e Peer B vanno offline simultaneamente.
    2. Modificano *esattamente lo stesso campo di testo* dello stesso oggetto (es. Peer A scrive "Mela", Peer B scrive "Pera").
    3. Entrambi i peer si riconnettono contemporaneamente (o in sequenza).
    4. *Risultato Atteso:* Nessun crash. Entrambi i peer devono convergere verso **esattamente lo stesso valore finale**, stabilito dal protocollo (per timestamp/clientID vittorioso).
*   [ ] **Creazione Concorrente Pura (Test ANTI-CASCADING WIPE - "Mysteriously Disappearing Data"):**
    1. Creare o entrare in un progetto *completamente vuoto*, senza alcuna DataSource o Institution esistente.
    2. Peer A e Peer B vanno offline.
    3. **Azione critica:** Peer A crea la sua prima Institution. Peer B crea la *sua* prima Institution, diversa. Opzionalmente creare anche entità legate all'istituzione (ad es. un datasource).
    4. Tornare online contemporaneamente.
    5. *Risultato Atteso:* Entrambe le tuple devono apparire e coesistere nei database e sulle UI di ambo i peer. **Nessun oggetto deve scomparire misteriosamente nel vuoto.**
*   [ ] **Conflitto su Relazione molti-a-molti (`objects_datasources`):**
    1. Preparare un Object O e due Datasource D1 e D2 già sincronizzati.
    2. Peer A e Peer B vanno offline.
    3. Peer A collega O a D1. Peer B collega lo stesso O a D2.
    4. Tornare online.
    5. *Risultato Atteso:* L'Object deve risultare collegato a entrambe le Datasource, senza duplicati della stessa relazione e senza perdita di uno dei due legami.
*   [ ] **Doppio Inserimento della Stessa Relazione Unica:**
    1. Preparare un Object O e una Datasource D già sincronizzati, ma non ancora collegati.
    2. Peer A e Peer B vanno offline.
    3. Entrambi creano lo stesso collegamento O-D.
    4. Tornare online.
    5. *Risultato Atteso:* Deve esistere un solo record della relazione. Nessun crash, nessun loop di retry infinito, nessun errore persistente di vincolo unico nei log.
*   [ ] **Riassegnazione Concorrente di Parent:**
    1. Preparare un Object O collegato a Institution A.
    2. Peer A e Peer B vanno offline.
    3. Peer A sposta O sotto Institution B. Peer B modifica campi dell'Object O e/o lo sposta sotto Institution C.
    4. Tornare online.
    5. *Risultato Atteso:* Tutti i peer devono convergere sullo stesso parent finale dell'oggetto e le modifiche non strutturali dell'oggetto non devono andare perse.

---

## 4. Test Resurrezione e Cancellazione Asincrona (Il Fix "Ghost Object")
**Obiettivo:** Testare il tracking delle `tombstone` per la non-resurrezione di dati morti.

*   [ ] **Cancellazione da parte del nodo Online vs Offline:**
    1. A e B sono sincronizzati e condividono l'Oggetto X.
    2. Peer B perde la connessione o chiude l'app.
    3. Mentre B è offline o chiuso, Peer A preme "Elimina" sull'Oggetto X.
    4. Peer B riapre l'app e si riconnette al progetto.
    5. *Risultato Atteso (Critico):* Sul client di Peer B l'Oggetto X *deve scomparire e allinearsi logicamente* con la decisione di Peer A. Sull'app di Peer A, l'Oggetto X **non deve in alcun modo "resuscitare"**.
*   [ ] **Cancellazione a Cascata di una Institution con Figli Offline:**
    1. Preparare una Institution con almeno un Object, una Datasource e un Asset collegati.
    2. Peer B va offline.
    3. Peer A elimina la Institution padre.
    4. Mentre è offline, Peer B modifica uno dei figli appena rimossi (ad es. cambia il nome dell'Object o aggiunge una relazione alla Datasource).
    5. Peer B torna online.
    6. *Risultato Atteso:* I figli eliminati non devono riapparire. La cascata deve prevalere in modo coerente su entrambi i peer e non devono restare relazioni orfane.
*   [ ] **Eliminazione di Campo Referenziato da Oggetti:**
    1. Preparare un Research Field o Ontology Field già usato da più oggetti.
    2. Peer A e Peer B vanno offline.
    3. Peer A elimina il field. Peer B modifica il valore del medesimo field su uno o più oggetti.
    4. Tornare online.
    5. *Risultato Atteso:* Il sistema deve convergere senza record `objects_research_fields` o `objects_ontology_fields` orfani e senza errori di integrità nel database locale.

---

## 5. Asset e WebTorrent (Sincronizzazione File Pesanti)
**Obiettivo:** Appurare il corretto streaming logico dei file via P2P.

*   [ ] **Distribuzione Asset Semplice:**
    1. Peer A carica un file di grosse dimensioni come Assset.
    2. Peer B vede apparire la notifica/icona nell'UI "in download" o stato pendente o dal menu a tendina "Missing Assets".
    3. Verificare i contatori sulla dashboard di presenza per vedere completato il download via P2P (WebTorrent/Buffer).
    4. Peer B apre/mostra l'asset nell'app. Deve essere perfettamente e strutturalmente integro (nessuna corruzione).
*   [ ] **Download Asincrono Postumo:**
    1. Peer A carica un asset pesante e chiude l'app (terminando il seeding).
    2. Peer B si connette più tardi. Entra nel sistema, vede l'oggetto ma capisce che l'asset manca o è indisponibile.
    3. Peer A riapre l'app e torna a condividere il progetto: il TorrentManager dovrebbe far riprendere il seeding all'istante verso Peer B, che completerà il download recuperando l'asset arretrato. 
*   [ ] **Metadata presenti ma file fisico assente:**
    1. Sincronizzare un asset tra Peer A e Peer B.
    2. Su Peer B, simulare la perdita del file fisico locale lasciando però intatto il record SQLite dell'asset.
    3. Forzare una riconciliazione o riconnessione.
    4. *Risultato Atteso:* Il sistema deve degradare lo stato dell'asset a "missing" o equivalente, senza dichiararlo disponibile localmente, e deve provare a recuperarlo da un peer che lo possiede ancora.
*   [ ] **Ripristino dei metadata di un asset non piu reperibile nel swarm:**
    1. Creare e sincronizzare un asset tra Peer A e Peer B.
    2. Eliminare l'asset su entrambi i peer, assicurandosi che anche il file fisico sia stato rimosso localmente.
    3. Ripristinare o reinserire solo i metadata dell'asset su uno dei due peer.
    4. Tornare online o forzare una nuova riconciliazione.
    5. *Risultato Atteso:* L'asset deve risultare chiaramente mancante o non recuperabile. L'app non deve andare in errore, non deve segnare il file come disponibile e non deve creare falsi positivi nello stato di seeding/downloading.

---

## 6. Relazioni Complesse e Integrità Referenziale
**Obiettivo:** Verificare che il sistema converga anche quando le modifiche toccano catene di entità collegate, testi condivisi e propagazioni indirette.

*   [ ] **Traduzioni concorrenti su testo condiviso:**
    1. Preparare una Institution con `name_id` e una o più traduzioni associate nella tabella `translations`.
    2. Peer A e Peer B vanno offline.
    3. Peer A modifica il testo originale. Peer B modifica una traduzione dello stesso testo in una lingua diversa.
    4. Tornare online.
    5. *Risultato Atteso:* Devono convergere sia il testo originale sia la traduzione modificata, senza duplicati di `texts` o `translations`, e i riferimenti `name_id` devono restare validi.
*   [ ] **Rimappatura del template dai campi institution ai campi dell'ontologia con modifiche concorrenti agli oggetti già importati:**
    1. Preparare un Template collegato a più Object tramite Datasource, con campi importati gia mappati dai campi institution verso campi dell'ontologia.
    2. Peer A e Peer B vanno offline.
    3. Peer A modifica il Template cambiando la mappatura di uno o più campi institution verso campi dell'ontologia diversi. Peer B modifica direttamente uno degli Object già derivati da quella stessa importazione.
    4. Tornare online.
    5. *Risultato Atteso:* Il sistema deve convergere senza duplicare campi ontologici sugli oggetti, senza perdere il collegamento tra Object, Datasource e Template, e senza sovrascrivere modifiche non confliggenti fatte localmente sugli Object.
*   [ ] **Cancellazione del parent con relazioni secondarie residue:**
    1. Preparare un Object con collegamenti a Asset, Datasource, Research Field e Ontology Field.
    2. Peer A elimina l'Object mentre Peer B è offline.
    3. Peer B, ancora offline, aggiunge o modifica una relazione secondaria dell'Object appena eliminato.
    4. Peer B torna online.
    5. *Risultato Atteso:* L'Object non deve resuscitare e tutte le tabelle ponte correlate devono risultare pulite o coerenti, senza riferimenti a un `object_id` inesistente.

---

## 7. Stress Test e Robustezza
**Obiettivo:** Crash, edge cases rari e tenuta massiva.

*   [ ] **Ricaricamento Rapido e Interruzioni:** Mentre l'applicazione sta ingombrando o caricando un grande progetto o un diff importante, utilizzare un task manager per *killare/interrompere* brutalmente il processo Electron. Riaprendo, controllare i log (f12) se il change-tailer ed il snapshot-hydrate partono normalmente senza aver corrotto la chain di SQLite né gettare errori di `FOREIGN KEY constraint failed`.
*   [ ] **Modifiche massive concorrenti:** Creare bulk di 50+ elementi su un client e 50+ sull'altro. Riunirli. Valutare che non avvengano esclusioni o scarti involontari nel batch.
*   [ ] **Bulk con grafo relazionale completo:** Creare in offline su Peer A almeno 20 Institution, 20 Datasource, 50 Object, collegamenti `objects_datasources`, `objects_assets`, campi ontology/research e traduzioni; in parallelo fare un batch diverso su Peer B. Alla riconnessione verificare non solo il conteggio totale, ma anche la correttezza dei legami e l'assenza di record orfani.