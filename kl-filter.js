(function($) {

    var PRICE_MIN = 0, PRICE_MAX = 25000000, PRICE_STEP = 250000;
    var SIZE_MIN  = 0, SIZE_MAX  = 2000,     SIZE_STEP  = 50;

    var SIZE_BUCKETS = [
        { slug: '100-to-500',   min: 100,  max: 500  },
        { slug: '510-to-1000',  min: 510,  max: 1000 },
        { slug: '1100-to-1500', min: 1100, max: 1500 },
        { slug: '1510-to-2000', min: 1510, max: 2000 },
    ];

    var WIDGET_CONFIGS = [
        { type: 'dropdown', key: 'location'     },
        { type: 'dropdown', key: 'listing_type' },
        { type: 'dropdown', key: 'bedrooms'     },
        { type: 'slider', id: 'size',  min: SIZE_MIN,  max: SIZE_MAX,  step: SIZE_STEP,  fmt: fmtSize,  loKey: 'size_lo',  hiKey: 'size_hi'  },
        { type: 'slider', id: 'price', min: PRICE_MIN, max: PRICE_MAX, step: PRICE_STEP, fmt: fmtPrice, loKey: 'price_lo', hiKey: 'price_hi' },
    ];

    var state = {
        location: null, listing_type: null, bedrooms: null,
        size_lo: SIZE_MIN,  size_hi: SIZE_MAX,
        price_lo: PRICE_MIN, price_hi: PRICE_MAX
    };

    function fmtPrice(v) {
        if (v === 0) return '0 NIS';
        return v >= 1000000
            ? (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M NIS'
            : (v / 1000).toFixed(0) + 'K NIS';
    }

    function fmtSize(v) {
        return v === 0 ? '0 sqm' : v + ' sqm';
    }

    function el(tag, cls) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        return e;
    }

    var CARD_SELECTORS = [
        '.elementor-posts-container article',
        '.elementor-posts article',
        '.elementor-posts-container .elementor-post',
        '.elementor-posts .elementor-post',
        '.ekit-post-item',
        '.e-loop-item'
    ];

    function findCards() {
        for (var i = 0; i < CARD_SELECTORS.length; i++) {
            var found = $(CARD_SELECTORS[i]);
            if (found.length > 0) return found;
        }
        return $();
    }

    // Load More button selector
    var LOAD_MORE_SELECTORS = [
        '.elementor-button-wrapper a',
        '.e-load-more-button',
        '.elementor-posts__load-more',
        'button.elementor-button',
        'a.elementor-button',
        '.load-more-btn',
    ];

    function findLoadMore() {
        for (var i = 0; i < LOAD_MORE_SELECTORS.length; i++) {
            var $btn = $(LOAD_MORE_SELECTORS[i]).filter(function() {
                return /load.?more/i.test($(this).text());
            });
            if ($btn.length) return $btn;
        }
        // Fallback: any element whose text is "Load More"
        return $('a, button').filter(function() {
            return /load.?more/i.test($(this).text().trim());
        });
    }

    function getPostId($node) {
        var cls = $node.attr('class') || '';
        var m   = cls.match(/\bpost-(\d+)\b/);
        return m ? m[1] : null;
    }

    function stampCards() {
        findCards().each(function() {
            var $c = $(this);
            if ($c.attr('data-kl-stamped')) return;
            $c.attr('data-kl-stamped', '1');

            var pid = getPostId($c);
            if (!pid) {
                $c.find('*').each(function() {
                    var id = getPostId($(this));
                    if (id) { pid = id; return false; }
                });
            }
            if (!pid) pid = getPostId($c.parent());

            if (pid && window.klPropertyData && window.klPropertyData[pid]) {
                var d = window.klPropertyData[pid];
                $c.attr('data-kl-id', pid);
                if (d.location     && d.location.length)     $c.attr('data-kl-loc', d.location.join(','));
                if (d.listing_type && d.listing_type.length) $c.attr('data-kl-lt',  d.listing_type.join(','));
                if (d.bedrooms     && d.bedrooms.length)     $c.attr('data-kl-bed', d.bedrooms.join(','));
                if (d.sizes        && d.sizes.length)        $c.attr('data-kl-sz',  d.sizes.join(','));
            }

            var nums   = ($c.text().match(/\d[\d,]+/g) || []);
            var prices = nums.map(function(n) {
                return parseInt(n.replace(/,/g, ''));
            }).filter(function(n) {
                return n >= 1000000 && n <= 100000000;
            });
            if (prices.length) $c.attr('data-kl-price', Math.max.apply(null, prices));
        });
    }

    function matchesTerm(attrVal, selected) {
        if (!selected) return true;
        return (attrVal || '').split(',').filter(Boolean).indexOf(selected) !== -1;
    }

    function isFiltering() {
        return state.location !== null ||
               state.listing_type !== null ||
               state.bedrooms !== null ||
               state.size_lo > SIZE_MIN ||
               state.size_hi < SIZE_MAX ||
               state.price_lo > PRICE_MIN ||
               state.price_hi < PRICE_MAX;
    }

    function applyFilters() {
        var $cards   = findCards();
        var $loadBtn = findLoadMore();
        var vis      = 0;
        var filtering = isFiltering();

        $cards.each(function() {
            var $c   = $(this);
            var show = true;

            if (!matchesTerm($c.attr('data-kl-loc'), state.location))     show = false;
            if (!matchesTerm($c.attr('data-kl-lt'),  state.listing_type)) show = false;
            if (!matchesTerm($c.attr('data-kl-bed'), state.bedrooms))     show = false;

            if (show) {
                var sizes = ($c.attr('data-kl-sz') || '').split(',').filter(Boolean);
                if (sizes.length > 0) {
                    var szOk = false;
                    for (var i = 0; i < SIZE_BUCKETS.length; i++) {
                        var b = SIZE_BUCKETS[i];
                        if (sizes.indexOf(b.slug) !== -1 && b.max >= state.size_lo && b.min <= state.size_hi) {
                            szOk = true; break;
                        }
                    }
                    if (!szOk) show = false;
                }
            }

            if (show) {
                var price = parseInt($c.attr('data-kl-price') || 0);
                if (!price) {
                    var pid = $c.attr('data-kl-id');
                    if (pid && window.klPropertyData && window.klPropertyData[pid])
                        price = window.klPropertyData[pid].price || 0;
                }
                if (price > 0 && (price < state.price_lo || price > state.price_hi)) show = false;
            }

            $c.css('display', show ? '' : 'none');
            if (show) vis++;
        });

        // ── No results message ──────────────────────────────────────
        var $nr = $('.kl-no-results');
        if (!$nr.length) {
            var nr = el('div', 'kl-no-results');
            nr.textContent = 'No properties found matching your filters.';
            findCards().first()
                .closest('.elementor-posts-container, .elementor-posts, [class*="posts-container"]')
                .after(nr);
            $nr = $(nr);
        }
        $nr.toggle(vis === 0 && filtering);

        // ── Hide Load More when filtering ───────────────────────────
        if ($loadBtn.length) {
            // Hide the button and its wrapper when filters are active
            var $btnWrap = $loadBtn.closest('.elementor-button-wrapper, .e-load-more-anchor, .elementor-widget');
            if ($btnWrap.length) {
                $btnWrap.css('display', filtering ? 'none' : '');
            } else {
                $loadBtn.css('display', filtering ? 'none' : '');
            }
        }
    }

    function closeAll() {
        $('.kl-dropdown').removeClass('kl-open');
    }

    function buildDropdown(taxKey) {
        var terms = (window.klTerms && window.klTerms[taxKey]) || [];

        var wrap    = el('div', 'kl-dropdown');
        var trigger = el('div', 'kl-drop-trigger');
        var menu    = el('div', 'kl-drop-menu');

        trigger.textContent = 'All';
        wrap.setAttribute('data-kl-tax', taxKey);

        var allTerms = [{slug: '', name: 'All'}].concat(terms);

        for (var i = 0; i < allTerms.length; i++) {
            var t   = allTerms[i];
            var opt = el('div', t.slug === '' ? 'kl-drop-opt kl-selected' : 'kl-drop-opt');
            opt.setAttribute('data-val', t.slug);
            opt.textContent = t.name;
            menu.appendChild(opt);
        }

        wrap.appendChild(trigger);
        wrap.appendChild(menu);

        var $wrap    = $(wrap);
        var $trigger = $(trigger);
        var $menu    = $(menu);

        $trigger.on('click', function(e) {
            e.stopPropagation();
            var wasOpen = $wrap.hasClass('kl-open');
            closeAll();
            if (!wasOpen) $wrap.addClass('kl-open');
        });

        $menu.on('click', '.kl-drop-opt', function() {
            var $opt = $(this);
            var val  = $opt.attr('data-val');
            $menu.find('.kl-drop-opt').removeClass('kl-selected');
            $opt.addClass('kl-selected');
            $trigger.text($opt.text());
            $wrap.removeClass('kl-open');
            state[taxKey] = val || null;
            applyFilters();
        });

        return $wrap;
    }

    function buildSlider(id, min, max, step, fmt, loKey, hiKey) {
        var widget   = el('div', 'kl-range-widget');
        var inner    = el('div', 'kl-range-inner');
        var vals     = el('div', 'kl-range-vals');
        var spanLo   = el('span', 'kl-val-lo');
        var spanHi   = el('span', 'kl-val-hi');
        var sliderWr = el('div', 'kl-dual-slider');
        var trackBg  = el('div', 'kl-track-bg');
        var trackFl  = el('div', 'kl-track-fill');

        widget.id          = 'kl-' + id + '-slider';
        spanLo.textContent = fmt(min);
        spanHi.textContent = fmt(max);

        vals.appendChild(spanLo);
        vals.appendChild(document.createTextNode(' \u2014 '));
        vals.appendChild(spanHi);

        var inpLo = document.createElement('input');
        inpLo.type = 'range'; inpLo.className = 'kl-inp-lo';
        inpLo.min = min; inpLo.max = max; inpLo.step = step; inpLo.value = min;

        var inpHi = document.createElement('input');
        inpHi.type = 'range'; inpHi.className = 'kl-inp-hi';
        inpHi.min = min; inpHi.max = max; inpHi.step = step; inpHi.value = max;

        sliderWr.appendChild(trackBg);
        sliderWr.appendChild(trackFl);
        sliderWr.appendChild(inpLo);
        sliderWr.appendChild(inpHi);

        inner.appendChild(vals);
        inner.appendChild(sliderWr);
        widget.appendChild(inner);

        var $w    = $(widget);
        var $lo   = $(inpLo);
        var $hi   = $(inpHi);
        var $fill = $(trackFl);

        function refreshTrack() {
            var r  = max - min;
            var lp = (($lo.val() - min) / r) * 100;
            var hp = (($hi.val() - min) / r) * 100;
            $fill.css({ left: lp + '%', width: (hp - lp) + '%' });
        }

        $w.on('input', 'input', function() {
            var lo = parseInt($lo.val()), hi = parseInt($hi.val());
            if (lo > hi) {
                if (this === inpLo) { lo = hi; $lo.val(lo); }
                else                { hi = lo; $hi.val(hi); }
            }
            spanLo.textContent = fmt(lo);
            spanHi.textContent = fmt(hi);
            refreshTrack();
            state[loKey] = lo;
            state[hiKey] = hi;
            applyFilters();
        });

        refreshTrack();
        return $w;
    }

    function replaceWidgets() {
        var $all = $('.elementor-widget-taxonomy-filter');
        if (!$all.length) return;

        $all.each(function(i) {
            var $w = $(this);
            if ($w.data('kl-done') || i >= WIDGET_CONFIGS.length) return;
            $w.data('kl-done', true).addClass('kl-filter-replaced');

            var cfg = WIDGET_CONFIGS[i];
            var $r  = cfg.type === 'dropdown'
                ? buildDropdown(cfg.key)
                : buildSlider(cfg.id, cfg.min, cfg.max, cfg.step, cfg.fmt, cfg.loKey, cfg.hiKey);

            $w.after($r);
        });
    }

    $(document).on('click.klfilter', function(e) {
        if (!$(e.target).closest('.kl-dropdown').length) closeAll();
    });

    function boot() {
        replaceWidgets();
        setTimeout(stampCards, 300);
    }

    $(document).ready(function() { setTimeout(boot, 500); });
    $(document).on('elementor/pro/frontend/filters/after_render', function() {
        setTimeout(boot, 300);
    });

})(jQuery);
