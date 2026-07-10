const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) enterApp(session);

  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('addWorkBtn').addEventListener('click', addWork);
  document.getElementById('addBlogBtn').addEventListener('click', addBlog);
});

async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const statusEl = document.getElementById('loginStatus');
  statusEl.textContent = 'Signing in…'; statusEl.className = 'status';
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { statusEl.textContent = error.message; statusEl.className = 'status err'; return; }
  enterApp(data.session);
}

async function logout() {
  await supabaseClient.auth.signOut();
  location.reload();
}

function enterApp(session) {
  loginScreen.style.display = 'none';
  appScreen.style.display = 'block';
  document.getElementById('userEmail').textContent = session.user.email;
  loadSettings();
  loadWork();
  loadBlog();
}

// ── Site settings ──────────────────────────────────────────────────────
async function loadSettings() {
  const { data } = await supabaseClient.from('site_settings').select('*').eq('id', 1).maybeSingle();
  if (!data) return;
  if (data.logo_url) { document.getElementById('logoPreview').src = data.logo_url; }
  if (data.favicon_url) { document.getElementById('faviconPreview').src = data.favicon_url; }
  if (data.book_call_url) { document.getElementById('bookCallUrl').value = data.book_call_url; }
}

async function uploadFile(fileInputEl, folder) {
  const file = fileInputEl.files[0];
  if (!file) return null;
  const path = `${folder}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
  const { error } = await supabaseClient.storage.from('media').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabaseClient.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

async function saveSettings() {
  const statusEl = document.getElementById('settingsStatus');
  statusEl.textContent = 'Saving…'; statusEl.className = 'status';
  try {
    const update = { book_call_url: document.getElementById('bookCallUrl').value.trim() || null };

    const logoUrl = await uploadFile(document.getElementById('logoFile'), 'logo');
    if (logoUrl) update.logo_url = logoUrl;

    const faviconUrl = await uploadFile(document.getElementById('faviconFile'), 'favicon');
    if (faviconUrl) update.favicon_url = faviconUrl;

    const { error } = await supabaseClient.from('site_settings').update(update).eq('id', 1);
    if (error) throw error;

    statusEl.textContent = 'Saved'; statusEl.className = 'status ok';
    loadSettings();
  } catch (err) {
    statusEl.textContent = err.message || 'Could not save'; statusEl.className = 'status err';
  }
}

// ── Featured work ──────────────────────────────────────────────────────
async function loadWork() {
  const list = document.getElementById('workList');
  const { data, error } = await supabaseClient.from('featured_work').select('*').order('sort_order', { ascending: true });
  if (error || !data) { list.innerHTML = '<p class="hint">Could not load.</p>'; return; }
  if (data.length === 0) { list.innerHTML = '<p class="hint">No projects yet — add one below.</p>'; return; }
  list.innerHTML = data.map(item => `
    <div class="item">
      <div>
        <div class="title">${escapeHtml(item.title)}</div>
        <div class="meta">${escapeHtml(item.tag || '')} · sort ${item.sort_order}</div>
      </div>
      <div class="item-actions">
        <button class="btn-danger" data-delete-work="${item.id}">Delete</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-delete-work]').forEach(btn => {
    btn.addEventListener('click', () => deleteWork(btn.dataset.deleteWork));
  });
}

async function addWork() {
  const statusEl = document.getElementById('workStatus');
  statusEl.textContent = 'Saving…'; statusEl.className = 'status';
  try {
    const imageUrl = await uploadFile(document.getElementById('workImageFile'), 'work');
    const payload = {
      title: document.getElementById('workTitle').value.trim(),
      tag: document.getElementById('workTag').value.trim(),
      description: document.getElementById('workDescription').value.trim(),
      result: document.getElementById('workResult').value.trim(),
      link_url: document.getElementById('workLink').value.trim() || '#contact',
      sort_order: parseInt(document.getElementById('workSort').value, 10) || 0,
      gradient_start: document.getElementById('workGradStart').value.trim() || '#0e2b4a',
      gradient_end: document.getElementById('workGradEnd').value.trim() || '#1f6fa8',
    };
    if (imageUrl) payload.image_url = imageUrl;
    if (!payload.title) throw new Error('Title is required');

    const { error } = await supabaseClient.from('featured_work').insert(payload);
    if (error) throw error;

    statusEl.textContent = 'Added'; statusEl.className = 'status ok';
    ['workTitle','workTag','workDescription','workResult','workLink'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('workImageFile').value = '';
    loadWork();
  } catch (err) {
    statusEl.textContent = err.message || 'Could not save'; statusEl.className = 'status err';
  }
}

async function deleteWork(id) {
  if (!confirm('Delete this project?')) return;
  await supabaseClient.from('featured_work').delete().eq('id', id);
  loadWork();
}

// ── Blog posts ─────────────────────────────────────────────────────────
async function loadBlog() {
  const list = document.getElementById('blogList');
  const { data, error } = await supabaseClient.from('blog_posts').select('*').order('sort_order', { ascending: true });
  if (error || !data) { list.innerHTML = '<p class="hint">Could not load.</p>'; return; }
  if (data.length === 0) { list.innerHTML = '<p class="hint">No posts yet — add one below.</p>'; return; }
  list.innerHTML = data.map(post => `
    <div class="item">
      <div>
        <div class="title">${escapeHtml(post.title)}</div>
        <div class="meta">${escapeHtml(post.kicker || '')} · sort ${post.sort_order} · ${post.published ? 'published' : 'hidden'}</div>
      </div>
      <div class="item-actions">
        <button class="btn-outline btn-small" data-toggle-blog="${post.id}" data-current="${post.published}">${post.published ? 'Hide' : 'Publish'}</button>
        <button class="btn-danger" data-delete-blog="${post.id}">Delete</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-toggle-blog]').forEach(btn => {
    btn.addEventListener('click', () => toggleBlog(btn.dataset.toggleBlog, btn.dataset.current === 'true'));
  });
  list.querySelectorAll('[data-delete-blog]').forEach(btn => {
    btn.addEventListener('click', () => deleteBlog(btn.dataset.deleteBlog));
  });
}

async function addBlog() {
  const statusEl = document.getElementById('blogStatus');
  statusEl.textContent = 'Saving…'; statusEl.className = 'status';
  try {
    const payload = {
      kicker: document.getElementById('blogKicker').value.trim(),
      title: document.getElementById('blogTitle').value.trim(),
      excerpt: document.getElementById('blogExcerpt').value.trim(),
      read_time: document.getElementById('blogReadTime').value.trim(),
      link_url: document.getElementById('blogLink').value.trim() || '#',
      sort_order: parseInt(document.getElementById('blogSort').value, 10) || 0,
      published: document.getElementById('blogPublished').checked,
    };
    if (!payload.title) throw new Error('Title is required');

    const { error } = await supabaseClient.from('blog_posts').insert(payload);
    if (error) throw error;

    statusEl.textContent = 'Added'; statusEl.className = 'status ok';
    ['blogKicker','blogTitle','blogExcerpt','blogReadTime','blogLink'].forEach(id => document.getElementById(id).value = '');
    loadBlog();
  } catch (err) {
    statusEl.textContent = err.message || 'Could not save'; statusEl.className = 'status err';
  }
}

async function toggleBlog(id, current) {
  await supabaseClient.from('blog_posts').update({ published: !current }).eq('id', id);
  loadBlog();
}

async function deleteBlog(id) {
  if (!confirm('Delete this post?')) return;
  await supabaseClient.from('blog_posts').delete().eq('id', id);
  loadBlog();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}
