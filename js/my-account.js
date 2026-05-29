document.addEventListener('DOMContentLoaded', () => {
    const nameEls = document.querySelectorAll('.acc-name');
    const matriculeEl = document.getElementById('acc-matricule');
    const gradeEl = document.getElementById('acc-grade');
    const bureauEl = document.getElementById('acc-bureau');
    const subtitleEl = document.getElementById('account-subtitle');
    const logoutBtn = document.getElementById('btn-logout');
    const backBtn = document.getElementById('btn-back');

    const alertEl = document.getElementById('account-alert');
    const form = document.getElementById('form-change-password');
    const panelEl = document.getElementById('change-password-panel');
    const loaderEl = document.getElementById('change-password-loader');
    const oldPwEl = document.getElementById('old-pw');
    const newPwEl = document.getElementById('new-pw');
    const newPw2El = document.getElementById('new-pw-2');
    const submitBtn = document.getElementById('btn-change-password');

    function showAlert(kind, msg) {
        if (!alertEl) return;
        if (!msg) {
            alertEl.classList.add('d-none');
            alertEl.textContent = '';
            alertEl.classList.remove('alert-success', 'alert-danger', 'alert-warning');
            return;
        }
        alertEl.classList.remove('d-none');
        alertEl.classList.remove('alert-success', 'alert-danger', 'alert-warning');
        alertEl.classList.add(kind === 'success' ? 'alert-success' : kind === 'warning' ? 'alert-warning' : 'alert-danger');
        alertEl.textContent = msg;
    }

    function setLoading(isLoading) {
        const v = Boolean(isLoading);
        if (panelEl) panelEl.classList.toggle('d-none', v);
        if (loaderEl) loaderEl.classList.toggle('d-none', !v);
        if (submitBtn) submitBtn.disabled = v;
        if (oldPwEl) oldPwEl.disabled = v;
        if (newPwEl) newPwEl.disabled = v;
        if (newPw2El) newPw2El.disabled = v;
    }

    let user = null;
    try {
        user = JSON.parse(localStorage.getItem('currentUser'));
    } catch {}

    if (!user || !user.token) {
        window.location.href = 'index.html';
        return;
    }

    // Auto logout when session TTL is reached (token expires server-side after ~6h)
    if (typeof window !== 'undefined' && typeof window.isSessionExpired === 'function' && window.isSessionExpired()) {
        if (typeof window.logoutToLogin === 'function') window.logoutToLogin();
        else window.location.href = 'index.html';
        return;
    }
    if (typeof window !== 'undefined' && typeof window.scheduleAutoLogout === 'function') window.scheduleAutoLogout();

    const displayName = user.frName || user.arName || '';
    nameEls.forEach((el) => {
        el.textContent = displayName || '--';
    });
    if (matriculeEl) matriculeEl.textContent = user.matricule ? String(user.matricule).trim() : '--';
    if (gradeEl) gradeEl.textContent = user.grade ? String(user.grade).trim() : '--';
    const bureauParts = [];
    if (user.bureauName) bureauParts.push(String(user.bureauName).trim());
    if (user.codeBr) bureauParts.push(`(${String(user.codeBr).trim()})`);
    if (bureauEl) bureauEl.textContent = bureauParts.length ? bureauParts.join(' ') : '--';
    if (subtitleEl) subtitleEl.textContent = user.bureauRegion ? String(user.bureauRegion).trim() : '--';

    logoutBtn?.addEventListener('click', () => {
        try {
            localStorage.removeItem('currentUser');
        } catch {}
        window.location.href = 'index.html';
    });

    backBtn?.addEventListener('click', () => {
        window.location.href = 'interface1.html';
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        showAlert('', '');
        if (loaderEl) loaderEl.classList.add('d-none');
        if (panelEl) panelEl.classList.remove('d-none');
        const oldPw = oldPwEl?.value || '';
        const newPw = newPwEl?.value || '';
        const newPw2 = newPw2El?.value || '';

        if (!oldPw.trim() || !newPw.trim() || !newPw2.trim()) {
            showAlert('warning', 'Veuillez remplir tous les champs.');
            return;
        }
        if (newPw !== newPw2) {
            showAlert('warning', 'La confirmation ne correspond pas.');
            return;
        }
        if (newPw.trim().length < 4) {
            showAlert('warning', 'Le nouveau mot de passe est trop court.');
            return;
        }

        setLoading(true);
        const res = await postAction('changePassword', { oldPw, newPw }).catch(() => null);
        setLoading(false);

        if (!res || !res.ok) {
            const err = res && res.error ? String(res.error) : 'unknown_error';
            showAlert('danger', err === 'invalid_old_password' ? "L'ancien mot de passe est incorrect." : 'Impossible de modifier le mot de passe.');
            if (panelEl) panelEl.classList.remove('d-none');
            if (loaderEl) loaderEl.classList.add('d-none');
            return;
        }

        if (oldPwEl) oldPwEl.value = '';
        if (newPwEl) newPwEl.value = '';
        if (newPw2El) newPw2El.value = '';
        showAlert('success', 'Mot de passe mis à jour.');
        if (panelEl) panelEl.classList.add('d-none');
        if (loaderEl) loaderEl.classList.add('d-none');
    });
});
