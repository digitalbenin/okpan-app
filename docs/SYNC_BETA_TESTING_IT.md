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
    3. **Azione critica:** Peer A crea la sua prima Data Source. Peer B crea la *sua* prima Data Source, diversa. (Oppure Istituzioni separate).
    4. Tornare online contemporaneamente.
    5. *Risultato Atteso:* Entrambe le tuple devono apparire e coesistere nei database e sulle UI di ambo i peer. **Nessun oggetto deve scomparire misteriosamente nel vuoto.**

---

## 4. Test Resurrezione e Cancellazione Asincrona (Il Fix "Ghost Object")
**Obiettivo:** Testare il tracking delle `tombstone` per la non-resurrezione di dati morti.

*   [ ] **Cancellazione da parte del nodo Online vs Offline:**
    1. A e B sono sincronizzati e condividono l'Oggetto X.
    2. Peer B perde la connessione o chiude l'app.
    3. Mentre B è offline o chiuso, Peer A preme "Elimina" sull'Oggetto X.
    4. Peer B riapre l'app e si riconnette al progetto.
    5. *Risultato Atteso (Critico):* Sul client di Peer B l'Oggetto X *deve scomparire e allinearsi logicamente* con la decisione di Peer A. Sull'app di Peer A, l'Oggetto X **non deve in alcun modo "resuscitare"**.

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

---

## 6. Stress Test e Robustezza
**Obiettivo:** Crash, edge cases rari e tenuta massiva.

*   [ ] **Ricaricamento Rapido e Interruzioni:** Mentre l'applicazione sta ingombrando o caricando un grande progetto o un diff importante, utilizzare un task manager per *killare/interrompere* brutalmente il processo Electron. Riaprendo, controllare i log (f12) se il change-tailer ed il snapshot-hydrate partono normalmente senza aver corrotto la chain di SQLite né gettare errori di `FOREIGN KEY constraint failed`.
*   [ ] **Modifiche massive concorrenti:** Creare bulk di 50+ elementi su un client e 50+ sull'altro. Riunirli. Valutare che non avvengano esclusioni o scarti involontari nel batch.