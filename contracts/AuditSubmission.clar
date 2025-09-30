(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-SUBMITTER u101)
(define-constant ERR-INVALID-HASH u102)
(define-constant ERR-INVALID-TONNAGE u103)
(define-constant ERR-INVALID-WASTE-TYPE u104)
(define-constant ERR-INVALID-REDUCTION-METRIC u105)
(define-constant ERR-AUDIT-ALREADY-EXISTS u106)
(define-constant ERR-AUDIT-NOT-FOUND u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-REGISTRY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-PERIOD u110)
(define-constant ERR-INVALID-CATEGORY u111)
(define-constant ERR-AUDIT-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-AUDITS-EXCEEDED u114)
(define-constant ERR-INVALID-AUDIT-STATUS u115)
(define-constant ERR-INVALID-LOCATION u116)
(define-constant ERR-INVALID-UNIT u117)
(define-constant ERR-INVALID-SOURCE u118)
(define-constant ERR-INVALID-VERIFICATION-LEVEL u119)
(define-constant ERR-INVALID-COMPLIANCE-SCORE u120)

(define-data-var next-audit-id uint u0)
(define-data-var max-audits uint u10000)
(define-data-var submission-fee uint u500)
(define-data-var registry-contract (optional principal) none)

(define-map audits
  uint
  {
    submitter: principal,
    data-hash: (buff 32),
    tonnage: uint,
    waste-type: (string-utf8 50),
    reduction-metric: uint,
    timestamp: uint,
    period: uint,
    category: (string-utf8 50),
    location: (string-utf8 100),
    unit: (string-utf8 20),
    source: (string-utf8 100),
    verification-level: uint,
    compliance-score: uint,
    status: bool
  }
)

(define-map audits-by-hash
  (buff 32)
  uint)

(define-map audit-updates
  uint
  {
    update-tonnage: uint,
    update-reduction-metric: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-audit (id uint))
  (map-get? audits id)
)

(define-read-only (get-audit-updates (id uint))
  (map-get? audit-updates id)
)

(define-read-only (is-audit-registered (hash (buff 32)))
  (is-some (map-get? audits-by-hash hash))
)

(define-private (validate-submitter (submitter principal))
  (if (not (is-eq submitter 'SP000000000000000000002Q6VF78))
    (ok true)
    (err ERR-INVALID-SUBMITTER)
  )
)

(define-private (validate-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
    (ok true)
    (err ERR-INVALID-HASH)
  )
)

(define-private (validate-tonnage (tonnage uint))
  (if (> tonnage u0)
    (ok true)
    (err ERR-INVALID-TONNAGE)
  )
)

(define-private (validate-waste-type (wtype (string-utf8 50)))
  (if (and (> (len wtype) u0) (<= (len wtype) u50))
    (ok true)
    (err ERR-INVALID-WASTE-TYPE)
  )
)

(define-private (validate-reduction-metric (metric uint))
  (if (<= metric u100)
    (ok true)
    (err ERR-INVALID-REDUCTION-METRIC)
  )
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR-INVALID-TIMESTAMP)
  )
)

(define-private (validate-period (period uint))
  (if (> period u0)
    (ok true)
    (err ERR-INVALID-PERIOD)
  )
)

(define-private (validate-category (cat (string-utf8 50)))
  (if (or (is-eq cat "organic") (is-eq cat "recyclable") (is-eq cat "hazardous"))
    (ok true)
    (err ERR-INVALID-CATEGORY)
  )
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
    (ok true)
    (err ERR-INVALID-LOCATION)
  )
)

(define-private (validate-unit (unit (string-utf8 20)))
  (if (or (is-eq unit "kg") (is-eq unit "ton") (is-eq unit "lb"))
    (ok true)
    (err ERR-INVALID-UNIT)
  )
)

(define-private (validate-source (src (string-utf8 100)))
  (if (and (> (len src) u0) (<= (len src) u100))
    (ok true)
    (err ERR-INVALID-SOURCE)
  )
)

(define-private (validate-verification-level (level uint))
  (if (<= level u5)
    (ok true)
    (err ERR-INVALID-VERIFICATION-LEVEL)
  )
)

(define-private (validate-compliance-score (score uint))
  (if (<= score u100)
    (ok true)
    (err ERR-INVALID-COMPLIANCE-SCORE)
  )
)

(define-public (set-registry-contract (contract-principal principal))
  (begin
    (try! (validate-submitter contract-principal))
    (asserts! (is-none (var-get registry-contract)) (err ERR-REGISTRY-NOT-VERIFIED))
    (var-set registry-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-audits (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get registry-contract)) (err ERR-REGISTRY-NOT-VERIFIED))
    (var-set max-audits new-max)
    (ok true)
  )
)

(define-public (set-submission-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get registry-contract)) (err ERR-REGISTRY-NOT-VERIFIED))
    (var-set submission-fee new-fee)
    (ok true)
  )
)

(define-public (submit-audit
  (data-hash (buff 32))
  (tonnage uint)
  (waste-type (string-utf8 50))
  (reduction-metric uint)
  (period uint)
  (category (string-utf8 50))
  (location (string-utf8 100))
  (unit (string-utf8 20))
  (source (string-utf8 100))
  (verification-level uint)
  (compliance-score uint)
)
  (let (
    (next-id (var-get next-audit-id))
    (current-max (var-get max-audits))
    (registry (var-get registry-contract))
  )
    (asserts! (< next-id current-max) (err ERR-MAX-AUDITS-EXCEEDED))
    (try! (validate-hash data-hash))
    (try! (validate-tonnage tonnage))
    (try! (validate-waste-type waste-type))
    (try! (validate-reduction-metric reduction-metric))
    (try! (validate-period period))
    (try! (validate-category category))
    (try! (validate-location location))
    (try! (validate-unit unit))
    (try! (validate-source source))
    (try! (validate-verification-level verification-level))
    (try! (validate-compliance-score compliance-score))
    (asserts! (is-none (map-get? audits-by-hash data-hash)) (err ERR-AUDIT-ALREADY-EXISTS))
    (let ((registry-recipient (unwrap! registry (err ERR-REGISTRY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get submission-fee) tx-sender registry-recipient))
    )
    (map-set audits next-id
      {
        submitter: tx-sender,
        data-hash: data-hash,
        tonnage: tonnage,
        waste-type: waste-type,
        reduction-metric: reduction-metric,
        timestamp: block-height,
        period: period,
        category: category,
        location: location,
        unit: unit,
        source: source,
        verification-level: verification-level,
        compliance-score: compliance-score,
        status: true
      }
    )
    (map-set audits-by-hash data-hash next-id)
    (var-set next-audit-id (+ next-id u1))
    (print { event: "audit-submitted", id: next-id })
    (ok next-id)
  )
)

(define-public (update-audit
  (audit-id uint)
  (update-tonnage uint)
  (update-reduction-metric uint)
)
  (let ((audit (map-get? audits audit-id)))
    (match audit
      a
        (begin
          (asserts! (is-eq (get submitter a) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-tonnage update-tonnage))
          (try! (validate-reduction-metric update-reduction-metric))
          (map-set audits audit-id
            {
              submitter: (get submitter a),
              data-hash: (get data-hash a),
              tonnage: update-tonnage,
              waste-type: (get waste-type a),
              reduction-metric: update-reduction-metric,
              timestamp: block-height,
              period: (get period a),
              category: (get category a),
              location: (get location a),
              unit: (get unit a),
              source: (get source a),
              verification-level: (get verification-level a),
              compliance-score: (get compliance-score a),
              status: (get status a)
            }
          )
          (map-set audit-updates audit-id
            {
              update-tonnage: update-tonnage,
              update-reduction-metric: update-reduction-metric,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "audit-updated", id: audit-id })
          (ok true)
        )
      (err ERR-AUDIT-NOT-FOUND)
    )
  )
)

(define-public (get-audit-count)
  (ok (var-get next-audit-id))
)

(define-public (check-audit-existence (hash (buff 32)))
  (ok (is-audit-registered hash))
)