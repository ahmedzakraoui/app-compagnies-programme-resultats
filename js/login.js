document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('login-form');
    const matriculeEl = document.getElementById('login-matricule');
    const pwEl = document.getElementById('login-pw');
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit');

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
        if (submitBtn) submitBtn.disabled = Boolean(isLoading);
        if (matriculeEl) matriculeEl.disabled = Boolean(isLoading);
        if (pwEl) pwEl.disabled = Boolean(isLoading);
    }

    try {
        const existing = localStorage.getItem('currentUser');
        if (existing) {
            const u = JSON.parse(existing);
            if (u && typeof u === 'object' && u.token) {
                window.location.href = 'interface1.html';
                return;
            }
            localStorage.removeItem('currentUser');
        }
    } catch {}

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        setError('');
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
            setError('Identifiants invalides.');
            return;
        }

        try {
            localStorage.setItem('currentUser', JSON.stringify({ ...res.user, token: res.token }));
        } catch {}
        window.location.href = 'interface1.html';
    });
});
