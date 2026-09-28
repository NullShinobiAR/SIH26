# IntelliFreight — Maritime Decision Intelligence Platform

IntelliFreight is an institutional-grade Decision Intelligence Platform designed for dry-bulk charterers, thermal and coking coal importers, and maritime logistics planners. It bridges the gap between predictive machine learning, deterministic nautical physics, and multi-attribute financial optimization to deliver auditable, defensible chartering strategies.

---

## 1. Architectural Overview & System Modules

IntelliFreight operates on a strict pipeline orchestration architecture:

```
[ Chartering Request ]
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ 1. Port Feasibility Engine                             │
│    Deterministic validation across 6 physical constraints│
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ 2. Predictive ML & Chronological Backtesting Pipeline  │
│    Expanding-window backtest on 4 baseline/ML models    │
│    (Naive, Moving Average, Autoregressive, GBDT)       │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ 3. Voyage Cost & Bunker Fuel Physics Engine            │
│    Total Cost = Freight + Fuel + PDA + Demurrage + Canal│
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ 4. Multi-Attribute Decision Optimization (MADO) Engine │
│    Utility scoring across Spot, Short-Term, Mid, COA   │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ 5. Comprehensive Risk & Explainability Engine (MADO)   │
│    Grounding recommendations, switch-points & scenarios│
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ 6. Decision Memory & Post-Voyage Audit Repository      │
│    Repository Pattern with In-Memory & Cloud Extensibility│
└────────────────────────────────────────────────────────┘
```

---

## 2. Data Authenticity & Real Market Integration Governance

IntelliFreight enforces a strict **Zero-Hallucination & Provenance Governance Standard**. It draws unambiguous, auditable boundaries between real-world API observations, nautical specifications, mathematical derivations, and calibrated development proxies:

### Data Categorization Matrix

| Classification | Definition & Operational Boundary | System Implementation in IntelliFreight |
| :--- | :--- | :--- |
| **REAL** | Authenticated external market observations retrieved via verified HTTP/REST feeds within the configured freshness window (24 hours). | **Baltic Dry Index (BDI)**, **Baltic Capesize Index (BCI)**, and **Singapore VLSFO 0.5% Marine Fuel** retrieved live via OilPriceAPI. Tagged `REAL` / `LIVE` with exact ISO observation and retrieval timestamps. |
| **DERIVED** | Deterministic mathematical, physical, or financial calculations executed on real or verified inputs without subjective simulation. | **Voyage Fuel Consumption** ($D \times \text{SFC} \times \text{Speed}$), **Total Landed Cost ($/t)**, **Demurrage Liabilities**, **Carbon Intensity Indicator (CII)** rating, **Distance Calculations**, and **Risk-Adjusted Decision Scores**. |
| **SIMULATED** | Calibrated synthetic parameters, development test-vectors, or multi-scenario sensitivities used for offline backtesting and operational stress-testing. | **Synthetic AIS Vessel Queue Streams**, **Historical Freight Rate Generator for Model Training** (used until 52 real weekly observations are collected), **Commodity Price Benchmarks** (Australian Coking Coal, Newcastle Thermal Coal), and **Weather Delay Buffers**. |
| **ASSUMPTION** | Explicit charter party defaults configurable by the user. | Laytime allowances (e.g. 25,000 t/day), demurrage rates ($28,000/day), commission rates (1.25%), and operational buffer margins. |
| **STALE** | Genuine external observations whose observation timestamp exceeds the 24-hour freshness window (e.g., weekend exchange market closures). | Observations retrieved from OilPriceAPI or Baltic Exchange where `retrievedAt - observedAt > 24h`. Displayed with authentic reported price but flagged `STALE` and `isLive = false`. |
| **UNAVAILABLE** | External data feed that cannot be reached due to missing credentials, connection timeouts, or provider downtime. | Returned when `OILPRICE_API_KEY` is not set or network fails. **Strict Rule: The system NEVER silently falls back to simulated data. When live data fails, it outputs `UNAVAILABLE` with clear diagnostic notes.** |

### Connected External Providers

1. **OilPriceAPI Dry Bulk Freight Indices**:
   - **Indices**: `BALTIC_DRY_INDEX`, `BALTIC_CAPESIZE_INDEX`
   - **Endpoint**: `https://api.oilpriceapi.com/v1/prices/latest?by_code=[CODE]`
   - **Authentication**: Bearer/Token authorization via `OILPRICE_API_KEY` (server-side only)
   - **Unit**: points
   - **Disclosure**: Composite benchmark indices (Capesize, Panamax, Supramax) serving as macro shipping sentiment proxies, not route-specific voyage fixtures.

2. **OilPriceAPI Marine Fuel / Bunker Feed**:
   - **Benchmark**: `VLSFO_USD` (Singapore 0.5% Sulphur Marine Fuel)
   - **Endpoint**: `https://api.oilpriceapi.com/v1/prices/latest?by_code=VLSFO_USD`
   - **Authentication**: Bearer/Token authorization via `OILPRICE_API_KEY` (server-side only)
   - **Unit**: USD / Metric Tonne (MT)
   - **Operational Role**: Drives deterministic bunker fuel cost modeling and sensitivity curves.

### Requirements for Connecting Full Baltic Exchange Feeds

Direct Baltic Exchange route assessments (e.g., C3 Tubarao–Qingdao, C5 West Australia–Qingdao, P4TC, and India-specific coastal/import routes) require commercial subscriber licensing:
- **Authorized Credentials**: Enterprise subscriber API key configured via `BALTIC_EXCHANGE_API_KEY` environment variable.
- **Strict Anti-Scraping Policy**: IntelliFreight explicitly forbids web scraping, headless DOM automation, or unauthorized bypasses of Baltic Exchange data terms.
- **Adapter Architecture**: The `BalticExchangeRouteProvider` abstraction is pre-wired in `src/services/liveMarketDataService.ts` to seamlessly activate once enterprise subscriber credentials are provided, immediately converting India trade lane fixtures from `UNAVAILABLE` to `REAL`.

### Machine Learning Retraining Governance Gate

To preserve statistical integrity and prevent severe single-point overfitting:
- **Zero Premature Training**: The forecasting pipeline **refuses automated retraining** on live data until at least **52 continuous weekly external observations** are persisted in the `RealObservationRepository`.
- **Transparency**: The system never claims a model is trained on real data until verified historical coverage exists. Prior to reaching 52 observations, machine learning models continue using calibrated empirical baselines for expanding-window backtesting.

### Server-Side Key Security
All third-party credentials (`OILPRICE_API_KEY`, `BALTIC_EXCHANGE_API_KEY`) reside strictly in server-side memory (`server.ts` and `src/services/liveMarketDataService.ts`). No API key is ever prefixed with `VITE_` or exposed to browser client code.

---

## 3. Machine Learning Architecture & Chronological Backtesting

### The 4 Evaluated Models
1. **Naive Random Walk (Persistence Baseline)**:
   $$\hat{y}_{t+h} = y_t$$
   Serves as the minimum benchmark. Any model failing to beat Naive is automatically discarded.
2. **Rolling Moving Average Baseline**:
   $$\hat{y}_{t+h} = \frac{1}{k} \sum_{i=0}^{k-1} y_{t-i}$$
   Unweighted trailing window ($k=8$ weeks) to capture medium-term market drift.
3. **Autoregressive Seasonal Model (AR-OLS with Ridge Regularization)**:
   $$\hat{y}_{t+h} = \beta_0 + \sum_{i=1}^{p} \beta_i y_{t-i+1} + \sum_{j=1}^{s} \gamma_j S_j(t) + \lambda \|\beta\|_2^2$$
   Fits past lags ($p=4$) and Fourier seasonal components with L2 regularization to prevent collinearity overfitting.
4. **Gradient Boosted Decision Trees (GBDT)**:
   Constructs an ensemble of shallow decision trees ($\text{depth}=3$) iteratively fitting pseudo-residuals of the squared loss:
   $$r_{i,m} = -\left[\frac{\partial L(y_i, F(x_i))}{\partial F(x_i)}\right]_{F=F_{m-1}}$$
   Features include trailing returns, volatility, bunker price spreads, and seasonal momentum.
5. **Weighted Meta-Ensemble**:
   Dynamically weights constituent models based on inverse out-of-sample RMSE:
   $$w_m = \frac{(1 / \text{RMSE}_m)^\gamma}{\sum_j (1 / \text{RMSE}_j)^\gamma}$$

### Chronological Backtesting Methodology (No Look-Ahead Bias)
Traditional K-fold cross validation is **strictly prohibited** in financial and maritime time-series because random shuffling leaks future information into past predictions. 

IntelliFreight enforces an **Expanding-Window Backtesting Protocol**:
- Start with an initial training window $T_{\text{train}} = [0, t_0]$.
- Fit models strictly on observations up to $t_0$.
- Generate out-of-sample forecast for horizon $h \in [1, 4]$.
- Record actual vs. predicted values and compute step loss.
- Expand window: $t_0 \leftarrow t_0 + 1$ and repeat until end of dataset.

### Why Directional Accuracy is the Primary Operational Metric
While MAE ($/t) and MAPE (%) evaluate magnitude errors, commercial chartering decisions depend primarily on **market direction**:
$$\text{Directional Accuracy} = \frac{1}{N} \sum_{t=1}^N \mathbb{I}\left( \text{sign}(\hat{y}_{t+h} - y_t) == \text{sign}(y_{t+h} - y_t) \right)$$
- If the model predicts rates will rise by 5% and they rise by 8%, the charterer correctly locks in forward tonnage (correct commercial action).
- If a model with low MAE predicts a slight decline when rates actually spike, the charterer stays on spot and suffers massive financial losses.
- Directional accuracy directly drives the **Spot vs. Forward Contract** decision boundary.

---

## 4. Port Feasibility Engine: 6 Physical Constraints

The port feasibility engine verifies nautical compatibility using strict inequality constraints:
1. **Length Overall (LOA)**: $\text{Vessel LOA} \le \min(\text{Origin Max LOA}, \text{Destination Max LOA})$
2. **Beam**: $\text{Vessel Beam} \le \min(\text{Origin Max Beam}, \text{Destination Max Beam})$
3. **Draft**: $\text{Vessel Full Draft} \le \min(\text{Origin Max Draft}, \text{Destination Max Draft})$
4. **Berth Length**: $\text{Vessel LOA} \le \text{Destination Berth Length}$ (or anchorage transshipment)
5. **Cargo Compatibility**: Verification that vessel holds are certified for dry bulk (coal/bauxite/ore)
6. **Capacity Utilization**: Ratio $\frac{\text{Cargo MT}}{\text{Vessel Capacity MT}} \in [0.65, 1.08]$ to prevent dangerous underloading or unfeasible overloading

*Example*: A Capesize vessel (LOA 292m, Draft 18.2m) arriving at Haldia Dock Complex (Max LOA 190m, Estuary Draft 8.5m) is deterministically rejected with precise margin deficits calculated and alternative lightering ports (e.g. Sagar/Sandheads or Dhamra) recommended.

---

## 5. Voyage Cost Engine Formula & Breakdown

Calculates the complete voyage disbursement structure:
$$\text{Total Voyage Cost} = \text{Freight Cost} + \text{Bunker Cost} + \text{Port PDA} + \text{Demurrage} + \text{Canal Tolls} + \text{Carbon Cost} + \text{Agency/Misc}$$

1. **Sea Sailing Duration**: $T_{\text{sea}} = \frac{\text{Distance NM}}{\text{Speed (knots)} \times 24}$
2. **Port Handling Duration**: $T_{\text{port}} = \frac{\text{Cargo Tonnes}}{\text{Loading TPD}} + \frac{\text{Cargo Tonnes}}{\text{Discharge TPD}} + 1.6 \text{ days (customs/clearance)}$
3. **Demurrage Exposure**: Calculated from port waiting queues and vessel daily demurrage rate:
   $$\text{Demurrage Cost} = (W_{\text{load}} \times 0.5 + W_{\text{discharge}}) \times (\text{Daily Hire Rate} \times 1.10)$$
4. **Port Charges (PDA)**: Scaled by vessel deadweight tonnage ratio $\sqrt{\text{DWT} / 75000}$.
5. **Canal Tariffs**: Conditioned on route chokepoints (e.g., $280,000 for laden Suez transit; $220,000 for Neo-Panamax).
6. **Carbon Compliance**: IMO GHG factor: 3.114 tonnes $\text{CO}_2$ per tonne VLSFO; 3.206 per tonne MGO at regulatory shadow price ($65/t $\text{CO}_2$).

---

## 6. Multi-Attribute Decision Optimization (MADO)

Contract selection between **Spot**, **Short-Term Multi-Voyage (3–5 voyages)**, **Medium-Term Charter (6–12 months)**, and **Contract of Affreightment (COA)** is performed via an objective multi-attribute utility function:

$$\max_{s \in S} U(s) = w_{\text{cost}} \cdot S_{\text{cost}}(s) + w_{\text{risk}} \cdot S_{\text{risk}}(s) + w_{\text{flex}} \cdot S_{\text{flex}}(s) + \Delta_{\text{carry}}(s) - \Omega_{\text{commitment}}(s)$$

Where component scores are normalized against candidate bounds and weights shift based on the charterer's stated optimization preference:
- **Lowest Cost (`lowest_cost`)**: $w_{\text{cost}} = 0.70, w_{\text{risk}} = 0.15, w_{\text{flex}} = 0.15$
- **Balanced (`balanced`)**: $w_{\text{cost}} = 0.50, w_{\text{risk}} = 0.30, w_{\text{flex}} = 0.20$
- **Lowest Risk (`lowest_risk`)**: $w_{\text{cost}} = 0.20, w_{\text{risk}} = 0.60, w_{\text{flex}} = 0.20$

**Strategy Selection Dynamics**:
No strategy is artificially forced or hardcoded. All 4 candidates are evaluated through the utility formula:
- **Single Voyage ($N=1$)**: Spot often achieves the highest utility in flat or softening markets because forward commitments carry operational overhead ($\Omega_{\text{commitment}}$) without sufficient volume discounts, while Spot offers near-maximum flexibility ($S_{\text{flex}} = 0.95$).
- **Multi-Voyage ($N \ge 3$) in Rising Markets**: Forward contracts (COA, Short-Term, or Medium-Term) typically achieve superior utility scores by hedging against forecast spot inflation, capturing shipowner volume discounts, and providing positive market carry ($\Delta_{\text{carry}}$).
- **Risk vs. Cost Sensitivity**: Under `lowest_cost`, volume-discounted arrangements like COA prevail; under `lowest_risk`, structured Medium-Term charters with designated vessels and fixed laycans capture the highest utility by minimizing operational and market volatility.

---

## 7. Persistence Architecture: The Repository Pattern

IntelliFreight abstracts all data mutations through strongly-typed repositories:
- `IDecisionRepository`: CRUD operations for chartering recommendations and ex-post actual voyage outcomes.
- `IForecastRepository`: Cached backtest and forward prediction evaluations.
- `IScenarioRepository`: What-if simulation parameters and variance tracking.

Default implementation: `InMemoryDecisionRepository` (with automatic browser `localStorage` synchronization). Cloud adapters for Google Cloud Firestore, Supabase, or PostgreSQL can be plugged in by implementing `IDecisionRepository` without modifying business logic.

---

## 8. Verification & Automated Testing

Run the end-to-end unit and integration test suite:

```bash
npm run test
```

Verified test coverage:
1. Port feasibility rejection of Capesize at riverine ports (Haldia) and approval at deepwater ports (Dhamra).
2. ML backtesting expanding window logic and metric computation integrity.
3. Contract optimizer utility function responsiveness to voyage volume and market direction.
4. Voyage cost calculation realism and conditional canal toll triggers.
5. Repository persistence, outcome recording, and variance auditing.

---

## 9. SIH Evaluation & Jury Presentation Guide

When presenting IntelliFreight to judges and maritime domain experts:

1. **Be Truthful About Data**: Clearly state that port physical limits are verified Indian port specifications, while freight rates and bunker indices are benchmark historical data with simulated AIS streams. Never claim live API connectivity where synthetic fixtures exist.
2. **Explain the ML Rigor**: Highlight that backtesting uses expanding-window validation without lookahead leakage. Show the Model Performance screen where all 4 candidate models are compared.
3. **Demonstrate Port Feasibility First**: Show that the system will never recommend a vessel that cannot physically enter the port, citing draft, LOA, and beam checks.
4. **Explain the Optimization Logic**: Demonstrate why Spot wins for single voyages, but COA wins when multi-voyage volume faces a bullish market trend.
5. **Show Decision Memory**: Demonstrate closing the loop—recording the actual voyage fixture rate and calculating institutional prediction variance to eliminate cognitive bias.
