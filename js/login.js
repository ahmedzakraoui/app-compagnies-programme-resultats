document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const matriculeEl = document.getElementById('login-matricule');
    const pwEl = document.getElementById('login-pw');
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');
    const submitTextEl = document.getElementById('login-submit-text');
    const submitSpinnerEl = document.getElementById('login-submit-spinner');

    function setError(msg) {
        if (!errorEl) return;
        if (!msg) {
            errorEl.classList.add('d-none');
            errorEl.textContent = '';
            return;
        }
        errorEl.textContent = msg;
        errorEl.classList.remove('d-none');
    }

    function setLoading(isLoading) {
        const v = Boolean(isLoading);
        if (submitBtn) submitBtn.disabled = v;
        if (matriculeEl) matriculeEl.disabled = Boolean(isLoading);
        if (pwEl) pwEl.disabled = Boolean(isLoading);
        if (submitSpinnerEl) submitSpinnerEl.classList.toggle('d-none', !v);
        if (submitTextEl) submitTextEl.textContent = v ? 'Connexion…' : 'Se connecter';
    }

    function consumePostLoginRedirect() {
        try {
            const raw = localStorage.getItem('postLoginRedirect');
            if (!raw) return '';
            localStorage.removeItem('postLoginRedirect');
            const file = String(raw).trim();
            // Safety: only allow local html navigation
            if (!file.endsWith('.html') || file === 'index.html' || file.includes('/') || file.includes('\\')) return '';
            return file;
        } catch {
            return '';
        }
    }

    try {
        const existing = localStorage.getItem('currentUser');
        if (existing) {
            const u = JSON.parse(existing);
            const exp = u && typeof u === 'object' ? Number(u.sessionExpiresAt) : NaN;
            const isExpired = Number.isFinite(exp) ? Date.now() >= exp : false;
            if (u && typeof u === 'object' && u.token && !isExpired) {
                window.location.href = consumePostLoginRedirect() || 'interface1.html';
                return;
            }
            localStorage.removeItem('currentUser');
        }
    } catch {}

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        setError('');
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            setError('Pas de connexion internet');
            return;
        }
        const matricule = matriculeEl?.value.trim() || '';
        const pw = pwEl?.value || '';
        if (!matricule || !pw) {
            setError('Veuillez saisir le matricule et le mot de passe.');
            return;
        }

        setLoading(true);
        const res = await postAction('login', { matricule, pw });
        setLoading(false);

        if (!res || !res.ok || !res.user || !res.token) {
            if (res && (res.error === 'network_error' || res.error === 'http_error')) {
                setError('Pas de connexion internet');
                return;
            }
            setError('Identifiants invalides.');
            return;
        }

        try {
            const startedAt = Date.now();
            const ttl = typeof window !== 'undefined' && typeof window.SESSION_TTL_MS === 'number' ? window.SESSION_TTL_MS : 21600 * 1000;
            localStorage.setItem(
                'currentUser',
                JSON.stringify({ ...res.user, token: res.token, sessionStartedAt: startedAt, sessionExpiresAt: startedAt + ttl }),
            );
        } catch {}
        window.location.href = consumePostLoginRedirect() || 'interface1.html';
    });
});
