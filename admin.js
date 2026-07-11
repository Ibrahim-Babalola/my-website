const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');

let workQuill, blogQuill;
let workEditingId = null;
let blogEditingId = null;

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  initEditors();

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) enterApp(session);

  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('saveWorkBtn').addEventListener('click', saveWork);
  document.getElementById('cancelWorkEditBtn').addEventListener('click', () => resetWorkForm());
  document.getElementById('saveBlogBtn').addEventListener('click', saveBlog);
  document.getElementById('cancelBlogEditBtn').addEventListener('click', () => resetBlogForm());

  document.getElementById('workToggleSource').addEventListener('click', () => toggleSource('work'));
  document.getElementById('blogToggleSource').addEventListener('click', () => toggleSource('blog'));
});

// ── Tabs ───────────────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('screen-' + btn.dataset.tab).classList.add('active');
    });
  });
}

// ── Rich text editors ───────────────────────────────────────────────────
function initEditors() {
  const toolbarOptions = [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline', 'blockquote'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image', 'video'],
    ['clean'],
  ];

  workQuill = new Quill('#workBodyEditor', {
    theme: 'snow',
    modules: { toolbar: { container: toolbarOptions, handlers: { image: () => imageHandler(workQuill, 'work-content') } } },
  });
  blogQuill = new Quill('#blogBodyEditor', {
    theme: 'snow',
    modules: { toolbar: { container: toolbarOptions, handlers: { image: () => imageHandler(blogQuill, 'blog-content') } } },
  });
}

function imageHandler(quill, folder) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const url = await uploadFileObject(file, folder);
      const range = quill.getSelection(true) || { index: quill.getLength() };
      quill.insertEmbed(range.index, 'image', url, 'user');
      quill.setSelection(range.index + 1);
    } catch (err) {
      alert('Could not upload image: ' + err.message);
    }
  };
  input.click();
}

function toggleSource(which) {
  const quill = which === 'work' ? workQuill : blogQuill;
  const editorWrap = document.getElementById(which + 'BodyEditor').closest('.editor-wrap');
  const sourceEl = document.getElementById(which + 'BodySource');
  const btn = document.getElementById(which + 'ToggleSource');
  const showingSource = sourceEl.style.display === 'block';
  if (showingSource) {
    quill.setText('');
    quill.clipboard.dangerouslyPasteHTML(sourceEl.value);
    sourceEl.style.display = 'none';
    editorWrap.style.display = 'block';
    btn.textContent = '</> Edit HTML';
  } else {
    sourceEl.value = quill.root.innerHTML;
    sourceEl.style.display = 'block';
    editorWrap.style.display = 'none';
    btn.textContent = 'Back to rich text';
  }
}

function getEditorHtml(which) {
  const sourceEl = document.getElementById(which + 'BodySource');
  if (sourceEl.style.display === 'block') return sourceEl.value.trim();
  const quill = which === 'work' ? workQuill : blogQuill;
  const html = quill.root.innerHTML;
  return html === '<p><br></p>' ? '' : html;
}

function setEditorHtml(which, html) {
  const quill = which === 'work' ? workQuill : blogQuill;
  const sourceEl = document.getElementById(which + 'BodySource');
  const editorWrap = document.getElementById(which + 'BodyEditor').closest('.editor-wrap');
  const btn = document.getElementById(which + 'ToggleSource');
  quill.setText('');
  quill.clipboard.dangerouslyPasteHTML(html || '');
  sourceEl.value = '';
  sourceEl.style.display = 'none';
  editorWrap.style.display = 'block';
  btn.textContent = '</> Edit HTML';
}

// ── Auth ─────────────────────────────────────────────────────────────────
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

function slugify(str) {
  return String(str || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Site settings ──────────────────────────────────────────────────────
async function loadSettings() {
  const { data } = await supabaseClient.from('site_settings').select('*').eq('id', 1).maybeSingle();
  if (!data) return;
  if (data.logo_url) { document.getElementById('logoPreview').src = data.logo_url; }
  if (data.favicon_url) { document.getElementById('faviconPreview').src = data.favicon_url; }
  if (data.book_call_url) { document.getElementById('bookCallUrl').value = data.book_call_url; }
}

async function uploadFileObject(file, folder) {
  const path = `${folder}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
  const { error } = await supabaseClient.storage.from('media').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabaseClient.storage.from('media').getPublicUrl(path);
  return data.publicUrl;
}

async function uploadFile(fileInputEl, folder) {
  const file = fileInputEl.files[0];
  if (!file) return null;
  return uploadFileObject(file, folder);
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
        <div class="meta">${escapeHtml(item.tag || '')} · sort ${item.sort_order}${item.slug ? ` · <a href="work-detail.html?slug=${encodeURIComponent(item.slug)}" target="_blank">view page</a>` : ''}</div>
      </div>
      <div class="item-actions">
        <button class="btn-outline btn-small" data-edit-work="${item.id}">Edit</button>
        <button class="btn-danger" data-delete-work="${item.id}">Delete</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-edit-work]').forEach(btn => {
    btn.addEventListener('click', () => editWork(btn.dataset.editWork, data));
  });
  list.querySelectorAll('[data-delete-work]').forEach(btn => {
    btn.addEventListener('click', () => deleteWork(btn.dataset.deleteWork));
  });
}

function editWork(id, items) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  workEditingId = id;
  document.getElementById('workTitle').value = item.title || '';
  document.getElementById('workTag').value = item.tag || '';
  document.getElementById('workSlug').value = item.slug || '';
  document.getElementById('workDescription').value = item.description || '';
  setEditorHtml('work', item.body || '');
  document.getElementById('workResult').value = item.result || '';
  document.getElementById('workLink').value = item.link_url || '';
  document.getElementById('workSort').value = item.sort_order || 0;
  document.getElementById('workGradStart').value = item.gradient_start || '#0e2b4a';
  document.getElementById('workGradEnd').value = item.gradient_end || '#1f6fa8';
  document.getElementById('workImageFile').value = '';

  document.getElementById('workFormBadge').style.display = 'inline-block';
  document.getElementById('workFormTitle').textContent = 'Edit project';
  document.getElementById('saveWorkBtn').textContent = 'Save changes';
  document.getElementById('cancelWorkEditBtn').style.display = 'inline-block';

  document.querySelector('[data-tab="work"]').click();
  document.getElementById('workTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetWorkForm() {
  workEditingId = null;
  ['workTitle','workSlug','workTag','workDescription','workResult','workLink'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('workSort').value = 0;
  document.getElementById('workGradStart').value = '#0e2b4a';
  document.getElementById('workGradEnd').value = '#1f6fa8';
  document.getElementById('workImageFile').value = '';
  setEditorHtml('work', '');
  document.getElementById('workFormBadge').style.display = 'none';
  document.getElementById('workFormTitle').textContent = 'Add new project';
  document.getElementById('saveWorkBtn').textContent = 'Add project';
  document.getElementById('cancelWorkEditBtn').style.display = 'none';
  document.getElementById('workStatus').textContent = '';
}

async function saveWork() {
  const statusEl = document.getElementById('workStatus');
  statusEl.textContent = 'Saving…'; statusEl.className = 'status';
  try {
    const imageUrl = await uploadFile(document.getElementById('workImageFile'), 'work');
    const title = document.getElementById('workTitle').value.trim();
    const payload = {
      title,
      slug: slugify(document.getElementById('workSlug').value.trim() || title),
      tag: document.getElementById('workTag').value.trim(),
      description: document.getElementById('workDescription').value.trim(),
      body: getEditorHtml('work') || null,
      result: document.getElementById('workResult').value.trim(),
      link_url: document.getElementById('workLink').value.trim() || null,
      sort_order: parseInt(document.getElementById('workSort').value, 10) || 0,
      gradient_start: document.getElementById('workGradStart').value.trim() || '#0e2b4a',
      gradient_end: document.getElementById('workGradEnd').value.trim() || '#1f6fa8',
    };
    if (imageUrl) payload.image_url = imageUrl;
    if (!payload.title) throw new Error('Title is required');

    let error;
    if (workEditingId) {
      ({ error } = await supabaseClient.from('featured_work').update(payload).eq('id', workEditingId));
    } else {
      ({ error } = await supabaseClient.from('featured_work').insert(payload));
    }
    if (error) throw error;

    statusEl.textContent = workEditingId ? 'Saved' : 'Added'; statusEl.className = 'status ok';
    resetWorkForm();
    loadWork();
  } catch (err) {
    statusEl.textContent = err.message || 'Could not save'; statusEl.className = 'status err';
  }
}

async function deleteWork(id) {
  if (!confirm('Delete this project?')) return;
  await supabaseClient.from('featured_work').delete().eq('id', id);
  if (workEditingId === id) resetWorkForm();
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
        <div class="meta">${escapeHtml(post.kicker || '')} · sort ${post.sort_order} · ${post.published ? 'published' : 'hidden'}${post.slug ? ` · <a href="blog-post.html?slug=${encodeURIComponent(post.slug)}" target="_blank">view page</a>` : ''}</div>
      </div>
      <div class="item-actions">
        <button class="btn-outline btn-small" data-edit-blog="${post.id}">Edit</button>
        <button class="btn-outline btn-small" data-toggle-blog="${post.id}" data-current="${post.published}">${post.published ? 'Hide' : 'Publish'}</button>
        <button class="btn-danger" data-delete-blog="${post.id}">Delete</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-edit-blog]').forEach(btn => {
    btn.addEventListener('click', () => editBlog(btn.dataset.editBlog, data));
  });
  list.querySelectorAll('[data-toggle-blog]').forEach(btn => {
    btn.addEventListener('click', () => toggleBlog(btn.dataset.toggleBlog, btn.dataset.current === 'true'));
  });
  list.querySelectorAll('[data-delete-blog]').forEach(btn => {
    btn.addEventListener('click', () => deleteBlog(btn.dataset.deleteBlog));
  });
}

function editBlog(id, items) {
  const post = items.find(i => i.id === id);
  if (!post) return;
  blogEditingId = id;
  document.getElementById('blogKicker').value = post.kicker || '';
  document.getElementById('blogReadTime').value = post.read_time || '';
  document.getElementById('blogTitle').value = post.title || '';
  document.getElementById('blogSlug').value = post.slug || '';
  document.getElementById('blogExcerpt').value = post.excerpt || '';
  setEditorHtml('blog', post.body || '');
  document.getElementById('blogLink').value = post.link_url || '';
  document.getElementById('blogSort').value = post.sort_order || 0;
  document.getElementById('blogPublished').checked = !!post.published;

  document.getElementById('blogFormBadge').style.display = 'inline-block';
  document.getElementById('blogFormTitle').textContent = 'Edit post';
  document.getElementById('saveBlogBtn').textContent = 'Save changes';
  document.getElementById('cancelBlogEditBtn').style.display = 'inline-block';

  document.querySelector('[data-tab="blog"]').click();
  document.getElementById('blogTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetBlogForm() {
  blogEditingId = null;
  ['blogKicker','blogTitle','blogSlug','blogExcerpt','blogReadTime','blogLink'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('blogSort').value = 0;
  document.getElementById('blogPublished').checked = true;
  setEditorHtml('blog', '');
  document.getElementById('blogFormBadge').style.display = 'none';
  document.getElementById('blogFormTitle').textContent = 'Add new post';
  document.getElementById('saveBlogBtn').textContent = 'Add post';
  document.getElementById('cancelBlogEditBtn').style.display = 'none';
  document.getElementById('blogStatus').textContent = '';
}

async function saveBlog() {
  const statusEl = document.getElementById('blogStatus');
  statusEl.textContent = 'Saving…'; statusEl.className = 'status';
  try {
    const title = document.getElementById('blogTitle').value.trim();
    const payload = {
      kicker: document.getElementById('blogKicker').value.trim(),
      title,
      slug: slugify(document.getElementById('blogSlug').value.trim() || title),
      excerpt: document.getElementById('blogExcerpt').value.trim(),
      body: getEditorHtml('blog') || null,
      read_time: document.getElementById('blogReadTime').value.trim(),
      link_url: document.getElementById('blogLink').value.trim() || null,
      sort_order: parseInt(document.getElementById('blogSort').value, 10) || 0,
      published: document.getElementById('blogPublished').checked,
    };
    if (!payload.title) throw new Error('Title is required');

    let error;
    if (blogEditingId) {
      ({ error } = await supabaseClient.from('blog_posts').update(payload).eq('id', blogEditingId));
    } else {
      ({ error } = await supabaseClient.from('blog_posts').insert(payload));
    }
    if (error) throw error;

    statusEl.textContent = blogEditingId ? 'Saved' : 'Added'; statusEl.className = 'status ok';
    resetBlogForm();
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
  if (blogEditingId === id) resetBlogForm();
  loadBlog();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}
