# 🤖 AI Agent Integration Guide — MZVT Blog & Media Library Suite

> **Instructions for the AI Assistant / Developer:**
> You have received the complete **MZVT Blog & Media Library Suite** inside the `blogUI/` folder.
> Follow this step-by-step procedure to integrate 100% of the blog posting, category management, standalone media library, and award-winning frontend reader into the host Laravel + Inertia/React application.

---

## 📋 Executive Architecture Overview

| Component | Path in `blogUI/` | Description |
| :--- | :--- | :--- |
| **Migrations** | `database/migrations/` | 6 clean migrations (`categories`, `media`, `tags`, `articles`, `article_pivot_tables`, `comments`). |
| **Models** | `app/Models/` | `Article.php`, `Category.php`, `Comment.php`, `Media.php`, `Tag.php`. |
| **Admin Controllers** | `app/Http/Controllers/Admin/` | `ArticleController.php`, `CategoryController.php`, `MediaController.php`. |
| **Public Controllers** | `app/Http/Controllers/Public/` | `ArticleController.php`, `CategoryController.php`, `CommentController.php`. |
| **Admin Pages** | `resources/js/Pages/Admin/` | `Articles/` (`Index`, `Create`, `Edit`), `Categories/Index`, `Media/Index`. |
| **Public Pages** | `resources/js/Pages/Public/` | `Article/Show.tsx` (Reader), `Article/Index.tsx` (Archive), `Category/Show.tsx`. |
| **Editor & UI Components** | `resources/js/Components/` | `Editor/TiptapEditor.tsx`, `ui/CategorySelect.tsx`, `ui/Button.tsx`, `ui/Input.tsx`, `Comments.tsx`, `VideoEmbed.tsx`, `Public/BookmarkButton.tsx`, `Public/ReadBadge.tsx`. |
| **Layouts** | `resources/js/Layouts/` | Plug-and-play `AdminLayout.tsx` and `PublicLayout.tsx` with dark mode support. |
| **Media Library App** | `public/medialibrary/` | Zero-dependency high-performance file manager with WebP conversion and folder organization. |
| **Routes** | `routes/blog_routes.php` | Complete route blueprint for both public frontend and admin CMS. |

---

## 🚀 Step 1: File Copy & Placement

Copy the files from `blogUI/` directly into your main project directories:

```bash
# 1. Migrations
cp blogUI/database/migrations/* database/migrations/

# 2. Eloquent Models
cp blogUI/app/Models/* app/Models/

# 3. Controllers
mkdir -p app/Http/Controllers/Admin app/Http/Controllers/Public
cp blogUI/app/Http/Controllers/Admin/* app/Http/Controllers/Admin/
cp blogUI/app/Http/Controllers/Public/* app/Http/Controllers/Public/

# 4. React Pages & Components
mkdir -p resources/js/Pages/Admin/Articles resources/js/Pages/Admin/Categories resources/js/Pages/Admin/Media
mkdir -p resources/js/Pages/Public/Article resources/js/Pages/Public/Category
mkdir -p resources/js/Components/Editor resources/js/Components/ui resources/js/Components/Public
mkdir -p resources/js/Layouts resources/js/hooks

cp -R blogUI/resources/js/Pages/Admin/Articles/* resources/js/Pages/Admin/Articles/
cp -R blogUI/resources/js/Pages/Admin/Categories/* resources/js/Pages/Admin/Categories/
cp -R blogUI/resources/js/Pages/Admin/Media/* resources/js/Pages/Admin/Media/

cp -R blogUI/resources/js/Pages/Public/Article/* resources/js/Pages/Public/Article/
cp -R blogUI/resources/js/Pages/Public/Category/* resources/js/Pages/Public/Category/

cp -R blogUI/resources/js/Components/* resources/js/Components/
cp -R blogUI/resources/js/Layouts/* resources/js/Layouts/
cp -R blogUI/resources/js/hooks/* resources/js/hooks/

# 5. Media Library Public App
mkdir -p public/medialibrary/blog
cp -R blogUI/public/medialibrary/* public/medialibrary/
chmod -R 775 public/medialibrary/blog
```

---

## 🗄️ Step 2: Database Migration

Run the database migrations:

```bash
php artisan migrate
```

> **Note on User/Author Foreign Key:**
> `articles.user_id` references `users.id`. If your user table has a different primary key or model name, adjust the foreign key in `2026_01_01_000004_create_articles_table.php` before migrating, or ensure a default user exists.

---

## 📦 Step 3: Install Frontend Dependencies

Run the following command to install the required editor, date formatting, and icon packages:

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-image @tiptap/extension-link @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header @tiptap/extension-youtube @tiptap/extension-underline @tiptap/extension-color @tiptap/extension-text-style @tiptap/extension-code-block-lowlight lowlight lucide-react date-fns axios
```

---

## 🛣️ Step 4: Register Routes

In your `routes/web.php`, add:

```php
require __DIR__ . '/../blogUI/routes/blog_routes.php';
// OR copy the contents of blogUI/routes/blog_routes.php directly into your routes/web.php
```

### Route Summary:
- **Direct Image Serving:** `GET /blog/{path}` (serves WebP/JPG/PNG images with high-performance browser caching from `public/medialibrary/blog/{path}`)
- **Frontend Archive:** `GET /blog` (displays grid of articles, category pills, live search, pagination)
- **Frontend Article Reader:** `GET /article/{slug}` (table of contents, reading progress, code copy, author info, share buttons)
- **Frontend Comments:** `POST /article/{article}/comments` (nested comments and reply support)
- **Frontend Category:** `GET /category/{slug}` (subcategory pills, filtering, article cards)
- **Admin Articles List:** `GET /ourcms/articles`
- **Admin Article Editor:** `GET /ourcms/articles/create` & `GET /ourcms/articles/{id}/edit`
- **Admin Categories:** `GET /ourcms/categories`
- **Admin Media Library:** `GET /ourcms/media`

*(If your CMS uses a different admin prefix like `/admin`, you can change `'prefix' => 'ourcms'` to `'prefix' => 'admin'` in `blog_routes.php` and update the navigation links).*

---

## 🎨 Step 5: Layout Integration

- If you already have an existing **AdminLayout** or **PublicLayout**, you can simply keep your layout and ensure it provides `<slot />` or `{children}`.
- If not, `blogUI/resources/js/Layouts/AdminLayout.tsx` and `PublicLayout.tsx` are completely self-contained with dark mode, responsive mobile drawers, and modern Tailwind CSS design.

---

## 🖼️ Step 6: Verify Media Library & Editor Integration

1. Start your dev server:
   ```bash
   npm run dev
   # and
   php artisan serve
   ```
2. Navigate to `/ourcms/categories` to create your first category (e.g., "Technology" or "Tutorials").
3. Navigate to `/ourcms/articles/create`:
   - Click the **Media Library** tab in the Tiptap Editor or click **Select Image**.
   - Upload any image or choose from existing folders.
   - The image is saved directly and inserted with its clean `/blog/{path}` URL.
4. Save the article as **Published**.
5. Visit `/blog` and `/article/{slug}` to enjoy the ultra-fast, responsive reading UI.

---

## 💡 Troubleshooting & Tips

- **403 or 405 on Media Library upload:**
  Make sure `public/medialibrary/blog` is writable: `chmod -R 775 public/medialibrary/blog`.
- **LiteSpeed / Cloudflare WAF block on rich HTML:**
  `ArticleController.php` includes built-in UTF-8 Base64 decoding (`content_b64`) to bypass strict WAF firewalls automatically.
- **Images 404:**
  Ensure the direct route `Route::get('/blog/{path}', ...)` in `blog_routes.php` is loaded before any catch-all wildcards in your `routes/web.php`.
