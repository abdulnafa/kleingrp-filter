(function($) {

    var PRICE_MIN = 0,  PRICE_MAX = 40000000, PRICE_STEP = 500000;
    var SIZE_MIN  = 0,  SIZE_MAX  = 200,      SIZE_STEP  = 10;
    var BED_MIN   = 1,  BED_MAX   = 6,        BED_STEP   = 1;

    // Confirmed from property_size taxonomy admin
    var SIZE_BUCKETS = [
        { slug: '100-to-500',   min: 100, max: 200 },
        { slug: '510-to-1000',  min: 100, max: 200 },
        { slug: '1100-to-1500', min: 100, max: 200 },
        { slug: '1510-to-2000', min: 100, max: 200 },
    ];

    // Confirmed from bedrooms taxonomy admin
    var BED_MAP = {
        '1-bedroom':  1,
        '2-bedrooms': 2,
        '3-bedrooms': 3,
        '4-bedrooms': 4,
        '5-bedrooms': 5,
        '6-bedrooms': 6,
    };

    // Widget order: City | Sale/Rent | Bedrooms | Size | Price
    var WIDGET_CONFIGS = [
        { type: 'dropdown', key: 'location'     },
        { type: 'dropdown', key: 'listing_type' },
        { type: 'cslider',  id: 'bedrooms', min: BED_MIN,   max: BED_MAX,   step: BED_STEP,   fmt: fmtBed,   loKey: 'bed_lo',   hiKey: 'bed_hi'   },
        { type: 'cslider',  id: 'size',     min: SIZE_MIN,  max: SIZE_MAX,  step: SIZE_STEP,  fmt: fmtSize,  loKey: 'size_lo',  hiKey: 'size_hi'  },
        { type: 'cslider',  id: 'price',    min: PRICE_MIN, max: PRICE_MAX, step: PRICE_STEP, fmt: fmtPrice, loKey: 'price_lo', hiKey: 'price_hi' },
    ];

    var state = {
        location: null, listing_type: null,
        bed_lo:   BED_MIN,   bed_hi:   BED_MAX,
        size_lo:  SIZE_MIN,  size_hi:  SIZE_MAX,
        price_lo: PRICE_MIN, price_hi: PRICE_MAX,
    };

    function fmtPrice(v) {
        if (v === 0) return '0 NIS';
        var label = v >= 1000000
            ? (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
            : (v / 1000).toFixed(0) + 'K';
        return label + (v >= PRICE_MAX ? '+' : '') + ' NIS';
    }

    function fmtSize(v) {
        if (v === 0) return '0 sqm';
        return v + (v >= SIZE_MAX ? '+' : '') + ' sqm';
    }

    function fmtBed(v) {
        if (v <= BED_MIN) return '1 Bed';
        return v + (v >= BED_MAX ? '+' : '') + ' Beds';
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
            var f = $(CARD_SELECTORS[i]);
            if (f.length > 0) return f;
        }
        return $();
    }

    function getLoadMoreWrap() {
        var $btn = $('a, button').filter(function() {
            return /load.?more/i.test($(this).text().trim());
        });
        if (!$btn.length) return $();
        var $w = $btn.closest('.elementor-widget, .elementor-button-wrapper, .e-load-more-anchor');
        return $w.length ? $w : $btn.parent();
    }

    function getPostId($n) {
        var m = ($n.attr('class') || '').match(/\bpost-(\d+)\b/);
        return m ? m[1] : null;
    }

    function resetCards() {
        for (var i = 0; i < CARD_SELECTORS.length; i++) {
            $(CARD_SELECTORS[i]).css('display', '');
        }
        $('.e-hidden, .elementor-hidden').removeClass('e-hidden elementor-hidden');
    }

    function stampCards() {
        findCards().each(function() {
            var $c = $(this);
            if ($c.attr('data-kl-ok')) return;
            $c.attr('data-kl-ok', '1');

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

            var nums = ($c.text().match(/\d[\d,]+/g) || []);
            var prices = nums.map(function(n) {
                return parseInt(n.replace(/,/g, ''));
            }).filter(function(n) {
                return n >= 1000000 && n <= 200000000;
            });
            if (prices.length) $c.attr('data-kl-price', Math.max.apply(null, prices));
        });
    }

    function matchesTerm(attr, sel) {
        if (!sel) return true;
        return (attr || '').split(',').filter(Boolean).indexOf(sel) !== -1;
    }

    function isFiltering() {
        return state.location !== null ||
               state.listing_type !== null ||
               state.bed_lo   > BED_MIN   || state.bed_hi   < BED_MAX   ||
               state.size_lo  > SIZE_MIN  || state.size_hi  < SIZE_MAX  ||
               state.price_lo > PRICE_MIN || state.price_hi < PRICE_MAX;
    }

    function applyFilters() {
        var $cards    = findCards();
        var $lmWrap   = getLoadMoreWrap();
        var filtering = isFiltering();
        var vis       = 0;

        $cards.each(function() {
            var $c = $(this), show = true;

            // Dropdown filters
            if (!matchesTerm($c.attr('data-kl-loc'), state.location))     show = false;
            if (!matchesTerm($c.attr('data-kl-lt'),  state.listing_type)) show = false;

            // Bedrooms range
            if (show) {
                var bedSlugs = ($c.attr('data-kl-bed') || '').split(',').filter(Boolean);
                if (bedSlugs.length > 0) {
                    var bedOk = false;
                    for (var i = 0; i < bedSlugs.length; i++) {
                        var num = BED_MAP[bedSlugs[i]];
                        if (num !== undefined && num >= state.bed_lo && num <= state.bed_hi) {
                            bedOk = true; break;
                        }
                    }
                    if (!bedOk) show = false;
                }
            }

            // Size range
            if (show) {
                var sizes = ($c.attr('data-kl-sz') || '').split(',').filter(Boolean);
                if (sizes.length > 0) {
                    var szOk = false;
                    for (var j = 0; j < SIZE_BUCKETS.length; j++) {
                        var b = SIZE_BUCKETS[j];
                        if (sizes.indexOf(b.slug) !== -1 && b.max >= state.size_lo && b.min <= state.size_hi) {
                            szOk = true; break;
                        }
                    }
                    if (!szOk) show = false;
                }
            }

            // Price range
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

        // No results message
        var $nr = $('.kl-no-results');
        if (!$nr.length) {
            var nr = el('div', 'kl-no-results');
            nr.textContent = 'No properties found matching your filters.';
            $cards.first()
                .closest('.elementor-posts-container, .elementor-posts, [class*="posts-container"]')
                .after(nr);
            $nr = $(nr);
        }
        $nr.css('display', (vis === 0 && filtering) ? 'block' : 'none');

        // Hide Load More when filtering
        if ($lmWrap.length) $lmWrap.css('display', filtering ? 'none' : '');
    }

    /* ── CLOSE ALL ─────────────────────────────────────────────── */
    function closeAll() {
        $('.kl-dropdown').removeClass('kl-open');
        $('.kl-cslider').removeClass('kl-open');
    }

    /* ── BUILD DROPDOWN ────────────────────────────────────────── */
    function buildDropdown(taxKey) {
        var terms   = (window.klTerms && window.klTerms[taxKey]) || [];
        var wrap    = el('div', 'kl-dropdown');
        var trigger = el('div', 'kl-drop-trigger');
        var menu    = el('div', 'kl-drop-menu');

        trigger.textContent = 'All';

        var all = [{slug: '', name: 'All'}].concat(terms);
        for (var i = 0; i < all.length; i++) {
            var t   = all[i];
            var opt = el('div', t.slug === '' ? 'kl-drop-opt kl-selected' : 'kl-drop-opt');
            opt.setAttribute('data-val', t.slug);
            opt.textContent = t.name;
            menu.appendChild(opt);
        }

        wrap.appendChild(trigger);
        wrap.appendChild(menu);

        var $wrap = $(wrap), $trig = $(trigger), $menu = $(menu);

        $trig.on('click', function(e) {
            e.stopPropagation();
            var was = $wrap.hasClass('kl-open');
            closeAll();
            if (!was) $wrap.addClass('kl-open');
        });

        $menu.on('click', '.kl-drop-opt', function() {
            var $o  = $(this), val = $o.attr('data-val');
            $menu.find('.kl-drop-opt').removeClass('kl-selected');
            $o.addClass('kl-selected');
            $trig.text($o.text());
            $wrap.removeClass('kl-open');
            state[taxKey] = val || null;
            applyFilters();
        });

        return $wrap;
    }

    /* ── BUILD COLLAPSIBLE SLIDER ──────────────────────────────── */
    function buildCollapsibleSlider(id, min, max, step, fmt, loKey, hiKey) {
        var wrap    = el('div', 'kl-cslider');
        var trigger = el('div', 'kl-cs-trigger');
        var panel   = el('div', 'kl-cs-panel');
        var vals    = el('div', 'kl-range-vals');
        var spanLo  = el('span', 'kl-val-lo');
        var spanHi  = el('span', 'kl-val-hi');
        var slWr    = el('div', 'kl-dual-slider');
        var trackBg = el('div', 'kl-track-bg');
        var trackFl = el('div', 'kl-track-fill');

        trigger.textContent = 'All';
        spanLo.textContent  = fmt(min);
        spanHi.textContent  = fmt(max);

        vals.appendChild(spanLo);
        vals.appendChild(document.createTextNode(' \u2014 '));
        vals.appendChild(spanHi);

        var inpLo = document.createElement('input');
        inpLo.type = 'range'; inpLo.className = 'kl-inp-lo';
        inpLo.min = min; inpLo.max = max; inpLo.step = step; inpLo.value = min;

        var inpHi = document.createElement('input');
        inpHi.type = 'range'; inpHi.className = 'kl-inp-hi';
        inpHi.min = min; inpHi.max = max; inpHi.step = step; inpHi.value = max;

        slWr.appendChild(trackBg);
        slWr.appendChild(trackFl);
        slWr.appendChild(inpLo);
        slWr.appendChild(inpHi);

        panel.appendChild(vals);
        panel.appendChild(slWr);
        wrap.appendChild(trigger);
        wrap.appendChild(panel);

        var $wrap = $(wrap), $trig = $(trigger);
        var $lo   = $(inpLo), $hi = $(inpHi), $fill = $(trackFl);

        $trig.on('click', function(e) {
            e.stopPropagation();
            var was = $wrap.hasClass('kl-open');
            closeAll();
            if (!was) $wrap.addClass('kl-open');
        });

        function refreshTrack() {
            var r  = max - min;
            var lp = (($lo.val() - min) / r) * 100;
            var hp = (($hi.val() - min) / r) * 100;
            $fill.css({ left: lp + '%', width: (hp - lp) + '%' });
        }

        $wrap.on('input', 'input', function(e) {
            e.stopPropagation();
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

            // Fix overlap: when thumbs meet, raise z-index of the active thumb
            // so user can always drag it away from the stuck position
            if (lo === hi) {
                if (this === inpLo) {
                    inpLo.style.zIndex = 5;
                    inpHi.style.zIndex = 4;
                } else {
                    inpHi.style.zIndex = 5;
                    inpLo.style.zIndex = 4;
                }
            } else {
                inpLo.style.zIndex = '';
                inpHi.style.zIndex = '';
            }

            // Update trigger label
            $trig.text(lo <= min && hi >= max ? 'All' : fmt(lo) + ' \u2014 ' + fmt(hi));

            applyFilters();
        });

        refreshTrack();
        return $wrap;
    }

    /* ── REPLACE ALL 5 WIDGETS ─────────────────────────────────── */
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
                : buildCollapsibleSlider(cfg.id, cfg.min, cfg.max, cfg.step, cfg.fmt, cfg.loKey, cfg.hiKey);

            $w.after($r);
        });

        resetCards();
    }

    /* ── OUTSIDE CLICK ─────────────────────────────────────────── */
    $(document).on('click.klfilter', function(e) {
        if (!$(e.target).closest('.kl-dropdown, .kl-cslider').length) closeAll();
    });

    /* ── BOOT ──────────────────────────────────────────────────── */
    function boot() {
        if (window.location.search && window.location.search.indexOf('e-filter') !== -1) {
            window.location.href = window.location.pathname;
            return;
        }
        replaceWidgets();
        setTimeout(stampCards, 400);
    }

    $(document).ready(function() { setTimeout(boot, 500); });
    $(document).on('elementor/pro/frontend/filters/after_render', function() {
        setTimeout(boot, 300);
    });

})(jQuery);
