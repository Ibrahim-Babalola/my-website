// Pulls editable content from Supabase and drops it into the page.
// If Supabase isn't configured yet, or a table is empty, the site quietly
// keeps whatever is already hardcoded in index.html — nothing breaks.

document.addEventListener('DOMContentLoaded', () => {
  loadSiteSettings();
  loadFeaturedWork();
  loadBlogPosts();
});

async function loadSiteSettings() {
  try {
    const { data, error } = await supabaseClient
      .from('site_settings')
      .select('logo_url, favicon_url, book_call_url')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return;

    if (data.logo_url) {
      ['siteLogoImg', 'siteLogoImgFooter'].forEach(id => {
        const img = document.getElementById(id);
        if (img) { img.src = data.logo_url; img.style.display = 'block'; }
      });
      ['siteLogoName', 'siteLogoNameFooter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }

    if (data.favicon_url) {
      const fav = document.getElementById('favicon');
      if (fav) fav.href = data.favicon_url;
    }

    if (data.book_call_url) {
      document.querySelectorAll('[data-book-call]').forEach(a => {
        a.href = data.book_call_url;
        // Only override the smooth-scroll behavior if it's now an external link
        if (/^https?:\/\//.test(data.book_call_url)) {
          a.removeAttribute('data-scroll');
        }
      });
    }
  } catch (err) {
    console.error('Could not load site settings from Supabase:', err);
  }
}

async function loadFeaturedWork() {
  const grid = document.getElementById('workGrid');
  if (!grid) return;
  try {
    const { data, error } = await supabaseClient
      .from('featured_work')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) return; // keep hardcoded fallback

    grid.innerHTML = data.map(item => {
      const bg = item.image_url
        ? `background-image:url('${escapeAttr(item.image_url)}'); background-size:cover; background-position:center;`
        : `background:linear-gradient(135deg, ${escapeAttr(item.gradient_start || '#0e2b4a')}, ${escapeAttr(item.gradient_end || '#1f6fa8')});`;
      return `
        <a class="work-card" href="${escapeAttr(item.link_url || '#contact')}">
          <div class="thumb" style="${bg}"><div><h3>${escapeHtml(item.title)}</h3><div class="tag">${escapeHtml(item.tag || '')}</div></div></div>
          <div class="body"><p>${escapeHtml(item.description || '')}</p><div class="result">${escapeHtml(item.result || '')}</div></div>
        </a>`;
    }).join('');
  } catch (err) {
    console.error('Could not load featured work from Supabase:', err);
  }
}

async function loadBlogPosts() {
  const grid = document.getElementById('resGrid');
  if (!grid) return;
  try {
    const { data, error } = await supabaseClient
      .from('blog_posts')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) return; // keep hardcoded fallback

    grid.innerHTML = data.map(post => `
      <a class="res-card" href="${escapeAttr(post.link_url || '#')}" style="text-decoration:none;">
        <div class="kicker">${escapeHtml(post.kicker || '')}</div>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt || '')}</p>
        <div class="meta">${escapeHtml(post.read_time || '')}</div>
      </a>`).join('');
  } catch (err) {
    console.error('Could not load blog posts from Supabase:', err);
  }
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}
function escapeAttr(str) { return escapeHtml(str); }
