const API = '';
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return d.split('-').reverse().join('/');
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function dashboardPage() {
  return {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    entityId: '',
    entities: [],
    summary: null,
    flow: [],
    clientsSummary: [],
    loading: false,

    async init() {
      this.entities = await api('GET', '/api/entities');
      await this.load();
    },

    async load() {
      this.loading = true;
      const params = `year=${this.year}&month=${this.month}${this.entityId ? '&entity_id=' + this.entityId : ''}`;
      const [sum, flow, cs] = await Promise.all([
        api('GET', `/api/dashboard/summary?${params}`),
        api('GET', `/api/dashboard/monthly-flow?year=${this.year}${this.entityId ? '&entity_id=' + this.entityId : ''}`),
        api('GET', `/api/dashboard/clients-summary?year=${this.year}${this.entityId ? '&entity_id=' + this.entityId : ''}`),
      ]);
      this.summary = sum;
      this.flow = flow;
      this.clientsSummary = cs;
      this.loading = false;
    },

    fmt,
    fmtDate,
    MONTHS,

    netClass(v) { return v >= 0 ? 'text-green-600' : 'text-red-600'; },

    flowMax() {
      if (!this.flow.length) return 1;
      return Math.max(...this.flow.map(r => Math.max(r.income_received, r.expenses_paid)), 1);
    },
    barPct(v) { return Math.max(Math.round((v / this.flowMax()) * 100), 2); },
  };
}

// ─── PATRIMÔNIO ───────────────────────────────────────────────────────────────
function patrimonioPage() {
  return {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    entityId: '',
    entities: [],
    data: null,
    loading: false,
    showModal: false,
    editId: null,
    form: {},
    ASSET_TYPES: [
      { value: 'imovel', label: 'Imóvel' },
      { value: 'veiculo', label: 'Veículo' },
      { value: 'outro', label: 'Outro' },
    ],

    async init() {
      this.entities = await api('GET', '/api/entities');
      await this.load();
    },

    async load() {
      this.loading = true;
      const params = `inv_year=${this.year}&inv_month=${this.month}${this.entityId ? '&entity_id=' + this.entityId : ''}`;
      this.data = await api('GET', `/api/assets/patrimonio?${params}`);
      this.loading = false;
    },

    openCreate() {
      this.editId = null;
      this.form = { type: 'imovel', status: 'quitado', current_value: 0, total_financed: 0, amount_paid: 0 };
      this.showModal = true;
    },

    openEdit(a) {
      this.editId = a.id;
      this.form = { ...a };
      this.showModal = true;
    },

    async save() {
      if (this.editId) {
        await api('PUT', `/api/assets/${this.editId}`, this.form);
      } else {
        await api('POST', '/api/assets', this.form);
      }
      this.showModal = false;
      await this.load();
    },

    async remove(id) {
      if (!confirm('Excluir ativo?')) return;
      await api('DELETE', `/api/assets/${id}`);
      await this.load();
    },

    typeLabel(t) {
      return { imovel: 'Imóvel', veiculo: 'Veículo', outro: 'Outro' }[t] || t;
    },

    fmt,
    fmtDate,
  };
}

// ─── TRANSAÇÕES ───────────────────────────────────────────────────────────────
function transactionsPage() {
  return {
    year: new Date().getFullYear(),
    tab: 'expense',
    entityId: '',
    entities: [],
    paymentMethods: [],
    transactions: [],
    months: {},          // { tx_id: [TransactionMonthResponse x12] }
    loading: false,
    // create transaction modal
    showCreate: false,
    createForm: { type: 'expense', is_recurring: true, default_amount: 0 },
    // pay modal
    showPay: false,
    payForm: {},
    payTarget: null,   // { tm }

    async init() {
      [this.entities, this.paymentMethods] = await Promise.all([
        api('GET', '/api/entities'),
        api('GET', '/api/payment-methods'),
      ]);
      await this.load();
    },

    async load() {
      this.loading = true;
      const params = `year=${this.year}${this.entityId ? '&entity_id=' + this.entityId : ''}&type=${this.tab}`;
      this.transactions = await api('GET', `/api/transactions?${params}`);
      this.months = {};
      await Promise.all(this.transactions.map(async tx => {
        const ms = await api('GET', `/api/transactions/${tx.id}/months?year=${this.year}`);
        this.months[tx.id] = ms;
      }));
      this.loading = false;
    },

    monthsFor(txId) {
      const arr = this.months[txId] || [];
      return MONTHS.map((_, i) => arr.find(m => m.month === i + 1) || null);
    },

    cellClass(tm) {
      if (!tm) return 'cell-empty';
      if (tm.status === 'paid') return 'cell-paid';
      if (tm.status === 'skipped') return 'cell-skipped';
      return 'cell-pending';
    },

    cellText(tm) {
      if (!tm) return '—';
      return fmt(tm.amount);
    },

    openPay(tm) {
      this.payTarget = tm;
      this.payForm = {
        status: tm.status,
        amount: tm.amount,
        payment_method_id: tm.payment_method_id || '',
        paid_at: tm.paid_at || new Date().toISOString().slice(0, 10),
        notes: tm.notes || '',
      };
      this.showPay = true;
    },

    async savePay() {
      await api('PUT', `/api/transaction-months/${this.payTarget.id}`, this.payForm);
      this.showPay = false;
      await this.load();
    },

    async createTx() {
      const body = { ...this.createForm, generate_year: this.year };
      body.entity_id = parseInt(body.entity_id);
      await api('POST', '/api/transactions', body);
      this.showCreate = false;
      await this.load();
    },

    async removeTx(id) {
      if (!confirm('Excluir transação?')) return;
      await api('DELETE', `/api/transactions/${id}`);
      await this.load();
    },

    fmt,
    MONTHS,
  };
}

// ─── CLIENTES ─────────────────────────────────────────────────────────────────
function clientsPage() {
  return {
    year: new Date().getFullYear(),
    entityId: '',
    entities: [],
    paymentMethods: [],
    clients: [],
    payments: {},       // { client_id: [ClientPaymentResponse x12] }
    loading: false,
    showCreate: false,
    createForm: { recurrence: 'monthly', start_month: 1, amount: 0 },
    showPay: false,
    payForm: {},
    payTarget: null,

    async init() {
      [this.entities, this.paymentMethods] = await Promise.all([
        api('GET', '/api/entities'),
        api('GET', '/api/payment-methods'),
      ]);
      await this.load();
    },

    async load() {
      this.loading = true;
      const params = `${this.entityId ? 'entity_id=' + this.entityId + '&' : ''}is_active=true`;
      this.clients = await api('GET', `/api/clients?${params}`);
      this.payments = {};
      await Promise.all(this.clients.map(async c => {
        const ps = await api('GET', `/api/clients/${c.id}/payments?year=${this.year}`);
        this.payments[c.id] = ps;
      }));
      this.loading = false;
    },

    paymentsFor(clientId) {
      const arr = this.payments[clientId] || [];
      return MONTHS.map((_, i) => arr.find(p => p.month === i + 1) || null);
    },

    cellClass(cp) {
      if (!cp) return 'cell-empty';
      if (cp.status === 'paid') return 'cell-paid';
      return 'cell-pending';
    },

    openPay(cp) {
      if (!cp) return;
      this.payTarget = cp;
      this.payForm = {
        status: 'paid',
        amount: cp.amount,
        payment_method_id: cp.payment_method_id || '',
        paid_at: new Date().toISOString().slice(0, 10),
        notes: cp.notes || '',
      };
      this.showPay = true;
    },

    async savePay() {
      await api('PUT', `/api/client-payments/${this.payTarget.id}`, this.payForm);
      this.showPay = false;
      await this.load();
    },

    async createClient() {
      const body = { ...this.createForm, generate_year: this.year };
      body.entity_id = parseInt(body.entity_id);
      body.amount = parseFloat(body.amount);
      body.start_month = parseInt(body.start_month);
      await api('POST', '/api/clients', body);
      this.showCreate = false;
      await this.load();
    },

    async deactivate(id) {
      if (!confirm('Desativar cliente?')) return;
      await api('DELETE', `/api/clients/${id}`);
      await this.load();
    },

    recurrenceLabel(r) {
      return { monthly: 'Mensal', quarterly: 'Trimestral', annual: 'Anual', one_time: 'Única' }[r] || r;
    },

    fmt,
    MONTHS,
  };
}

// ─── INVESTIMENTOS ────────────────────────────────────────────────────────────
function investmentsPage() {
  return {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    entityId: '',
    entities: [],
    accounts: [],
    balances: {},     // { account_id: [InvestmentBalanceResponse x12] }
    summary: [],
    loading: false,
    showCreate: false,
    createForm: { type: 'renda_fixa', is_active: true },
    editingCell: null,  // { account_id, month, value }
    TYPES: [
      { value: 'previdencia',    label: 'Previdência' },
      { value: 'tesouro',        label: 'Tesouro Direto' },
      { value: 'renda_fixa',     label: 'Renda Fixa' },
      { value: 'renda_variavel', label: 'Renda Variável' },
    ],

    async init() {
      this.entities = await api('GET', '/api/entities');
      await this.load();
    },

    async load() {
      this.loading = true;
      const params = `${this.entityId ? 'entity_id=' + this.entityId + '&' : ''}is_active=true`;
      this.accounts = await api('GET', `/api/investments?${params}`);
      this.balances = {};
      await Promise.all(this.accounts.map(async acc => {
        const bs = await api('GET', `/api/investments/${acc.id}/balances?year=${this.year}`);
        this.balances[acc.id] = bs;
      }));
      const sumParams = `year=${this.year}&month=${this.month}${this.entityId ? '&entity_id=' + this.entityId : ''}`;
      this.summary = await api('GET', `/api/investments/summary/year?${sumParams}`);
      this.loading = false;
    },

    balanceFor(accountId, monthIdx) {
      const arr = this.balances[accountId] || [];
      return arr.find(b => b.month === monthIdx + 1) || null;
    },

    startEdit(accountId, monthIdx, bal) {
      this.editingCell = { account_id: accountId, month: monthIdx + 1, value: bal ? bal.balance : 0, contribution: bal ? bal.contribution : 0 };
    },

    async saveCell() {
      const { account_id, month, value, contribution } = this.editingCell;
      await api('PUT', `/api/investments/${account_id}/balances`, {
        year: this.year, month, balance: parseFloat(value) || 0, contribution: parseFloat(contribution) || 0,
      });
      this.editingCell = null;
      await this.load();
    },

    async createAccount() {
      const body = { ...this.createForm };
      body.entity_id = parseInt(body.entity_id);
      await api('POST', '/api/investments', body);
      this.showCreate = false;
      await this.load();
    },

    typeLabel(t) {
      return this.TYPES.find(x => x.value === t)?.label || t;
    },

    typeClass(t) {
      return `type-${t}`;
    },

    totalByType() {
      const map = {};
      for (const row of this.summary) {
        const lbl = this.typeLabel(row.type);
        map[lbl] = (map[lbl] || 0) + row.balance;
      }
      return Object.entries(map).sort((a, b) => b[1] - a[1]);
    },

    grandTotal() {
      return this.summary.reduce((s, r) => s + r.balance, 0);
    },

    colTotal(monthIdx) {
      return this.accounts.reduce((s, acc) => {
        const b = this.balanceFor(acc.id, monthIdx);
        return s + (b ? b.balance : 0);
      }, 0);
    },

    fmt,
    MONTHS,
  };
}

// ─── CONTAS A VENCER ──────────────────────────────────────────────────────────
function unplannedPage() {
  return {
    entityId: '',
    entities: [],
    paymentMethods: [],
    bills: [],
    loading: false,
    filterStatus: '',
    showCreate: false,
    createForm: { amount: 0 },
    showPay: false,
    payForm: {},
    payTarget: null,

    async init() {
      [this.entities, this.paymentMethods] = await Promise.all([
        api('GET', '/api/entities'),
        api('GET', '/api/payment-methods'),
      ]);
      await this.load();
    },

    async load() {
      this.loading = true;
      let params = '';
      if (this.entityId) params += `entity_id=${this.entityId}&`;
      if (this.filterStatus) params += `status=${this.filterStatus}`;
      this.bills = await api('GET', `/api/unplanned-bills?${params}`);
      this.loading = false;
    },

    totalPending() {
      return this.bills.filter(b => b.status === 'pending').reduce((s, b) => s + b.amount, 0);
    },

    openCreate() {
      this.createForm = { amount: 0 };
      this.showCreate = true;
    },

    async saveBill() {
      const body = { ...this.createForm };
      body.entity_id = parseInt(body.entity_id);
      body.amount = parseFloat(body.amount);
      await api('POST', '/api/unplanned-bills', body);
      this.showCreate = false;
      await this.load();
    },

    openPay(bill) {
      this.payTarget = bill;
      this.payForm = {
        status: 'paid',
        payment_method_id: '',
        paid_at: new Date().toISOString().slice(0, 10),
        notes: '',
      };
      this.showPay = true;
    },

    async savePay() {
      await api('PUT', `/api/unplanned-bills/${this.payTarget.id}`, this.payForm);
      this.showPay = false;
      await this.load();
    },

    async remove(id) {
      if (!confirm('Excluir conta?')) return;
      await api('DELETE', `/api/unplanned-bills/${id}`);
      await this.load();
    },

    fmt,
    fmtDate,
  };
}

// ─── MÉTODOS DE PAGAMENTO ─────────────────────────────────────────────────────
function paymentMethodsPage() {
  return {
    entities: [],
    methods: [],
    loading: false,
    showCreate: false,
    createForm: { type: 'bank' },

    async init() {
      this.entities = await api('GET', '/api/entities');
      await this.load();
    },

    async load() {
      this.loading = true;
      this.methods = await api('GET', '/api/payment-methods');
      this.loading = false;
    },

    banks()   { return this.methods.filter(m => m.type === 'bank'); },
    cards()   { return this.methods.filter(m => m.type === 'card'); },

    async saveMethod() {
      const body = { ...this.createForm };
      body.entity_id = parseInt(body.entity_id);
      await api('POST', '/api/payment-methods', body);
      this.showCreate = false;
      await this.load();
    },

    async remove(id) {
      if (!confirm('Excluir método?')) return;
      await api('DELETE', `/api/payment-methods/${id}`);
      await this.load();
    },
  };
}

// ─── ENTIDADES ────────────────────────────────────────────────────────────────
function entitiesPage() {
  return {
    entities: [],
    loading: false,
    showModal: false,
    editId: null,
    form: { name: '', color: '#6366f1' },
    COLORS: ['#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444','#6366f1','#ec4899','#14b8a6'],

    async init() {
      await this.load();
    },

    async load() {
      this.loading = true;
      this.entities = await api('GET', '/api/entities');
      this.loading = false;
    },

    openCreate() {
      this.editId = null;
      this.form = { name: '', color: '#6366f1' };
      this.showModal = true;
    },

    openEdit(e) {
      this.editId = e.id;
      this.form = { name: e.name, color: e.color };
      this.showModal = true;
    },

    async save() {
      if (this.editId) {
        await api('PUT', `/api/entities/${this.editId}`, this.form);
      } else {
        await api('POST', '/api/entities', this.form);
      }
      this.showModal = false;
      await this.load();
    },

    async remove(id) {
      if (!confirm('Excluir entidade e todos os dados vinculados?')) return;
      await api('DELETE', `/api/entities/${id}`);
      await this.load();
    },
  };
}
