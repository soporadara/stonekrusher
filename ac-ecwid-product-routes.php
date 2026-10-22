<?php
/**
 * Plugin Name: American Compactors Ecwid Product Routes
 * Description: Renders Ecwid products at clean /store/...-pID URLs.
 */

defined('ABSPATH') || exit;

add_action('template_redirect', static function (): void {
    $path = (string) wp_parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

    if (!preg_match('~^/store/.+-p([0-9]+)/?$~i', $path, $matches)) {
        return;
    }

    $product_id = (int) $matches[1];
    if ($product_id < 1) {
        return;
    }

    global $wp_query;
    if ($wp_query instanceof WP_Query) {
        $wp_query->is_404 = false;
        $wp_query->is_page = true;
    }

    add_filter('pre_get_document_title', static function (): string {
        return 'Equipment Product | American Compactors';
    }, 999);
    add_filter('aioseo_breadcrumbs_trail', static function (array $crumbs): array {
        return [];
    }, 999);

    status_header(200);
    nocache_headers();

    get_header();
    ?>
    <main id="primary" class="site-main ac-ecwid-product-page">
        <div class="ac-ecwid-shell">
            <div id="my-store-80100025" class="ac-ecwid-store"></div>
        </div>
    </main>
    <style>
        .ac-ecwid-product-page { background: #f4f8fc; padding: 40px 16px 72px; min-height: 70vh; }
        .ac-ecwid-shell { max-width: 1240px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 4px; }
        @media (max-width: 767px) {
            .ac-ecwid-product-page { padding: 20px 8px 48px; }
            .ac-ecwid-shell { padding: 10px; }
        }
    </style>
    <script>
        (function () {
            var productId = <?php echo wp_json_encode($product_id); ?>;
            window.ecwid_script_defer = true;
            window.ecwid_dynamic_widgets = true;
            window._xnext_initialization_scripts = window._xnext_initialization_scripts || [];

            var widget = {
                widgetType: 'ProductBrowser',
                id: 'my-store-80100025',
                arg: [
                    'categoriesPerRow=3',
                    'views=grid(20,3) list(60) table(60)',
                    'categoryView=grid',
                    'searchView=list',
                    'id=my-store-80100025'
                ]
            };
            window._xnext_initialization_scripts.push(widget);

            var productReady = false;

            function openProduct() {
                if (window.Ecwid && typeof window.Ecwid.openPage === 'function') {
                    window.Ecwid.openPage('product', { id: productId });
                    return true;
                }
                return false;
            }

            var script = document.createElement('script');
            script.id = 'ac-ecwid-script';
            script.src = 'https://app.ecwid.com/script.js?80100025&data_platform=code';
            script.async = true;
            script.charset = 'utf-8';
            script.setAttribute('data-cfasync', 'false');
            script.onload = function () {
                var attempts = 0;
                var timer = window.setInterval(function () {
                    attempts += 1;
                    if (!productReady) openProduct();
                    if (productReady || attempts >= 40) window.clearInterval(timer);
                }, 500);

                var apiAttempts = 0;
                var apiTimer = window.setInterval(function () {
                    apiAttempts += 1;
                    if (window.Ecwid && window.Ecwid.OnPageLoaded && typeof window.Ecwid.OnPageLoaded.add === 'function') {
                        window.clearInterval(apiTimer);
                        window.Ecwid.OnPageLoaded.add(function (page) {
                            var loadedId = page && (page.productId || (page.product && page.product.id));
                            if (page && page.type === 'PRODUCT' && Number(loadedId) === productId) {
                                productReady = true;
                                document.documentElement.classList.add('ac-ecwid-product-ready');
                                return;
                            }
                            if (!productReady) window.setTimeout(openProduct, 100);
                        });
                        openProduct();
                    } else if (apiAttempts >= 40) {
                        window.clearInterval(apiTimer);
                    }
                }, 250);
            };
            document.body.appendChild(script);
        }());
    </script>
    <?php
    get_footer();
    exit;
}, 0);
