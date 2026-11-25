// ===== MVスライダー =====
(function () {
  // PCカンプ数値（ここを変える）
  var MV_CAMP_WIDTH = 1440; // Swiper全体の幅
  var MV_SLIDE_WIDTH = 877; // スライド幅
  var MV_SPACE = 23; // スライド間余白
  var LOOP_BUFFER_MIN = 5; // 5枚未満は loop 用に1セット複製

  // （全体幅 ＋ 余白）÷（スライド幅 ＋ 余白）
  // 例: (1440 + 23) / (877 + 23) ≒ 1.6256
  var mvSlidesPerView =
    (MV_CAMP_WIDTH + MV_SPACE) / (MV_SLIDE_WIDTH + MV_SPACE);

  // 1スライドの表示時間（ページャーのリング一周と同期）
  var MV_AUTOPLAY_DELAY = 3000;

  var mvSliderEl = document.querySelector(".mv_slider");
  if (!mvSliderEl) return;

  var wrapper = mvSliderEl.querySelector(".swiper-wrapper");
  if (!wrapper) return;

  var slides = Array.prototype.slice.call(wrapper.children);
  var uniqueCount = slides.length;
  var useLoopBuffer = uniqueCount > 0 && uniqueCount < LOOP_BUFFER_MIN;

  // 5枚未満: Swiper 初期化前に1セット複製（loop の左右見切れを安定させる）
  if (useLoopBuffer) {
    slides.forEach(function (slide) {
      wrapper.appendChild(slide.cloneNode(true));
    });
  }

  function renderPagerBullet(index, className) {
    return (
      '<button type="button" class="' +
      className +
      '" data-mv-pager-index="' +
      index +
      '" aria-label="スライド' +
      (index + 1) +
      'へ">' +
      '<svg class="mv_slider_pager_ring" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="mv_slider_pager_ring_bar" cx="50" cy="50" r="47" pathLength="100" />' +
      "</svg>" +
      "<span>" +
      (index + 1) +
      "</span></button>"
    );
  }

  var paginationConfig = useLoopBuffer
    ? {
        el: ".mv_slider_pager",
        type: "custom",
        renderCustom: function (swiper) {
          var active = swiper.realIndex % uniqueCount;
          var html = "";
          for (var i = 0; i < uniqueCount; i++) {
            html += renderPagerBullet(
              i,
              "swiper-pagination-bullet" +
                (i === active ? " swiper-pagination-bullet-active" : "")
            );
          }
          return html;
        },
      }
    : {
        el: ".mv_slider_pager",
        clickable: true,
        renderBullet: function (index, className) {
          return renderPagerBullet(index, className);
        },
      };

  var swiper = new Swiper(".mv_slider", {
    // SP
    slidesPerView: 1,
    spaceBetween: 0,
    speed: 1200,
    loop: true,
    autoplay: {
      delay: MV_AUTOPLAY_DELAY,
      disableOnInteraction: false,
    },
    // 矢印（HTML: .mv_slider_prev / .mv_slider_next）
    navigation: {
      prevEl: ".mv_slider_prev",
      nextEl: ".mv_slider_next",
    },
    // ページャー（中央スライド右下）
    pagination: paginationConfig,
    breakpoints: {
      // PC（カンプ計算結果を反映）
      920: {
        slidesPerView: mvSlidesPerView,
        spaceBetween: MV_SPACE,
        centeredSlides: true,
      },
    },
  });

  // 複製時: カスタムページャーのクリック（ユニーク枚数分のドット）
  if (useLoopBuffer) {
    var mvPagerEl = document.querySelector(".mv_slider_pager");
    if (mvPagerEl) {
      mvPagerEl.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-mv-pager-index]");
        if (!btn) return;
        var index = parseInt(btn.getAttribute("data-mv-pager-index"), 10);
        if (!isNaN(index)) swiper.slideToLoop(index);
      });
    }
  }

  // リング完了で遷移（autoplay はフォールバック）
  // renderCustom が DOM を書き換えるので paginationUpdate 後に要素を取り直す
  var ringHandler = null;
  var currentRing = null;

  function cleanupRing() {
    if (currentRing && ringHandler) {
      currentRing.removeEventListener("animationend", ringHandler);
    }
    currentRing = null;
    ringHandler = null;
  }

  function watchRing() {
    cleanupRing();
    requestAnimationFrame(function () {
      var ring = mvSliderEl.querySelector(
        ".swiper-pagination-bullet-active .mv_slider_pager_ring_bar"
      );
      if (!ring) return;
      currentRing = ring;
      ringHandler = function () {
        cleanupRing();
        swiper.autoplay.stop();
        swiper.slideNext();
      };
      ring.addEventListener("animationend", ringHandler);
    });
  }

  swiper.on("paginationUpdate", watchRing);
  swiper.on("slideChangeTransitionEnd", function () {
    swiper.autoplay.start();
    watchRing();
  });
  watchRing();

  // ページャーのリング一周時間を CSS 変数に設定
  var mvPagerEl2 = document.querySelector(".mv_slider_pager");
  if (mvPagerEl2) {
    mvPagerEl2.style.setProperty("--mv-pager-duration", MV_AUTOPLAY_DELAY + "ms");
  }
})();

// ===== スクロール連動（ヘッダー / スムース / About）=====
// scroll リスナーは1本。各機能は onScroll に登録するだけ
(function () {
  var handlers = [];
  var scheduled = false;

  function onScroll(handler) {
    handlers.push(handler);
  }

  window.addEventListener(
    "scroll",
    function () {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        var y = window.scrollY;
        for (var i = 0; i < handlers.length; i++) {
          handlers[i](y);
        }
      });
    },
    { passive: true }
  );

  // ----- PCヘッダー：スクロール連動でロゴが広がる／縮む -----
  (function () {
    var BP_PC = 920;
    var CAMP = 1440;
    var WIDTH_LARGE = 618; // 元の幅（変えない）
    var WIDTH_SMALL = 208; // コンパクト時の幅（変えない）
    var MARGIN_TOP_LARGE = -9;
    var SCROLL_RANGE = 180; // この距離で縮小完了（大きいほどゆっくり）
    var DEADZONE = 2; // これ未満は「一番上」扱い（リロード時の微小スクロール対策）

    var header = document.querySelector(".header");
    var logo = document.querySelector(".header_mybuddy");
    var headerLogo = document.querySelector(".header_logo");
    var blendLogo = document.querySelector(".header_mybuddy_blend");
    var mv = document.querySelector(".mv_slider") || document.querySelector(".mv");
    var logoImg = logo ? logo.querySelector("img") : null;
    var logoIntroDone = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!header || !logo) return;

    if (logoImg && !logoIntroDone) {
      logoImg.addEventListener("animationend", function (e) {
        if (e.animationName !== "mybuddyReveal") return;
        logoIntroDone = true;
        logo.classList.add("is-intro-done");
        syncBlendLogo();
      });
    } else if (logo) {
      logo.classList.add("is-intro-done");
    }

    // ブラウザのスクロール復元で途中位置になるのを防ぐ
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    var smoothScrollY = 0;
    var ticking = false;

    function lerp(a, b, t) {
      return a * (1 - t) + b * t;
    }

    // 序盤で大きく動く → 上に戻るとき後半で一気に広がる
    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    // SP用: 往復とも緩やか（戻りで急に広がらない）
    function easeInOutCubic(t) {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // CSS の min(pcCalc(n), n px) と同じ実寸
    function campToPx(value) {
      return Math.min((value / CAMP) * window.innerWidth, value);
    }

    function normalizeY(scrollY) {
      return scrollY < DEADZONE ? 0 : scrollY;
    }

    function syncBlendLogo() {
      if (!blendLogo || !mv) return;

      function resetBlend() {
        blendLogo.style.opacity = "0";
        logo.classList.remove("is-blend-active");
      }

      // コンパクト時 / 登場アニメ前は通常表示
      if (!logoIntroDone || header.classList.contains("is-compact")) {
        resetBlend();
        return;
      }

      var logoRect = logo.getBoundingClientRect();
      var mvRect = mv.getBoundingClientRect();
      var overlapTop = Math.max(logoRect.top, mvRect.top);
      var overlapBottom = Math.min(logoRect.bottom, mvRect.bottom);
      var overlapHeight = overlapBottom - overlapTop;

      // MVと重なっていないときは通常の黒ロゴ
      if (overlapHeight <= 0 || logoRect.width <= 0 || logoRect.height <= 0) {
        resetBlend();
        return;
      }

      // Figma「除外」: 白化したロゴ全体に exclusion
      // （明るい背景→黒っぽく / 暗い写真→白っぽく見える）
      logo.classList.add("is-blend-active");
      blendLogo.style.opacity = "1";
      blendLogo.style.width = logoRect.width + "px";
      blendLogo.style.height = "auto";
      blendLogo.style.left = logoRect.left + "px";
      blendLogo.style.top = logoRect.top + "px";
      blendLogo.style.transform = "none";
    }

    // SP/PC: 背景は透過させず ON/OFF。padding・ロゴは連続補間
    function setCompact(progress) {
      // 半透明フェードなし（0 or 1）
      header.style.setProperty("--header-bg", progress > 0 ? "1" : "0");
      // ブレンド停止など用。ほぼ縮みきってから付与
      header.classList.toggle("is-compact", progress > 0.85);
    }

    function applyHeaderPadding(t) {
      if (window.innerWidth < BP_PC) {
        // SP: paddingはCSSのまま固定（補間するとheader_logoが%幅でがたつく）
        header.style.padding = "";
        return;
      }
      // PC: top 50固定、左右 40→35、下 0→44（現行カンプ値）
      var top = campToPx(50);
      var side = lerp(campToPx(40), Math.min(campToPx(40), 35), t);
      var bottom = lerp(0, Math.min(campToPx(44), 44), t);
      header.style.padding = top + "px " + side + "px " + bottom + "px";
    }

    // SP用の定数（Figma 540:753: 375×62）
    var SP_BASE = 375;
    var SP_WIDTH_LARGE = 319;   // spCalc(319) 相当
    var SP_WIDTH_SMALL = 120;   // コンパクト時（Figma中央≈120）
    var SP_MARGIN_TOP_RATIO = 47 / 349;
    // 大きいほど縮小〜復帰がゆっくり（指スクロールに対する進行を抑える）
    var SP_SCROLL_RANGE = 700;

    function spToPx(v) {
      return (v / SP_BASE) * Math.min(window.innerWidth, SP_BASE);
    }

    function apply(scrollY) {
      scrollY = normalizeY(scrollY);

      if (window.innerWidth < BP_PC) {
        // SP: スクロール連動でロゴ縮小（往復とも緩やか）
        var sp = Math.min(Math.max(scrollY / SP_SCROLL_RANGE, 0), 1);
        var st = easeInOutCubic(sp);

        var sw = lerp(spToPx(SP_WIDTH_LARGE), spToPx(SP_WIDTH_SMALL), st);
        logo.style.width = sw + "px";
        logo.style.maxWidth = "";
        logo.style.top = lerp(0, 50, st) + "%";
        logo.style.marginTop = lerp(SP_MARGIN_TOP_RATIO * spToPx(349), 0, st) + "px";
        logo.style.transform = "translate(-50%, " + lerp(0, -50, st) + "%)";

        applyHeaderPadding(st);
        setCompact(sp);
        syncBlendLogo();
        return;
      }

      var progress = Math.min(Math.max(scrollY / SCROLL_RANGE, 0), 1);
      var t = easeOutCubic(progress); // 0=大きい / 1=小さい

      var w = lerp(campToPx(WIDTH_LARGE), campToPx(WIDTH_SMALL), t);
      logo.style.width = w + "px";
      logo.style.maxWidth = w + "px";
      logo.style.top = lerp(0, 50, t) + "%";
      logo.style.marginTop = lerp(campToPx(MARGIN_TOP_LARGE), 0, t) + "px";
      logo.style.transform = "translate(-50%, " + lerp(0, -50, t) + "%)";

      // ヘッダー背景・padding もロゴと同じ進行で連続変化（切替感をなくす）
      applyHeaderPadding(t);
      setCompact(progress);
      syncBlendLogo();
    }

    // ロゴ位置だけ同期（スクロール位置は動かさない）
    // ※ SP はアドレスバー出し入れで resize が頻発するため、ここで scrollTo(0,0) すると
    //   スクロール直後に最上端へ引き戻される
    function syncStyles() {
      var y = normalizeY(window.scrollY || window.pageYOffset || 0);
      smoothScrollY = y;
      logo.style.transition = "none";
      header.style.transition = "none";
      apply(y);
      void logo.offsetWidth;
      logo.style.transition = "";
      header.style.transition = "";
    }

    // 初回ロード時のみ：ハッシュなしなら先頭へ（途中復元のチラつき防止）
    function syncHardOnLoad() {
      var y = normalizeY(window.scrollY || window.pageYOffset || 0);
      if (!location.hash && y > 0) {
        window.scrollTo(0, 0);
        y = 0;
      }
      smoothScrollY = y;
      logo.style.transition = "none";
      header.style.transition = "none";
      apply(y);
      void logo.offsetWidth;
      logo.style.transition = "";
      header.style.transition = "";
    }

    function tick() {
      var current = normalizeY(window.scrollY);

      // SP: タッチのネイティブスクロールに直接追従（慣性補間すると戻り時にがたつく）
      if (window.innerWidth < BP_PC) {
        smoothScrollY = current;
        apply(current);
        ticking = false;
        return;
      }

      // PC: 慣性を少し持たせて広がりをなめらかに
      smoothScrollY = lerp(smoothScrollY, current, 0.12);
      apply(smoothScrollY);

      if (Math.abs(current - smoothScrollY) > 0.2) {
        requestAnimationFrame(tick);
      } else {
        ticking = false;
        apply(current);
      }
    }

    function onHeaderScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(tick);
      }
    }

    // SP はアドレスバー出し入れで height だけ変わる resize が頻発 → 無視
    var lastInnerWidth = window.innerWidth;
    function onResize() {
      var w = window.innerWidth;
      if (w === lastInnerWidth && w < BP_PC) return;
      lastInnerWidth = w;
      syncStyles();
    }

    onScroll(onHeaderScroll);
    window.addEventListener("resize", onResize);
    window.addEventListener("load", syncHardOnLoad);
    window.addEventListener("pageshow", function (e) {
      // bfcache 復帰では位置を維持。通常ロード時だけ先頭へ
      if (e.persisted) {
        syncStyles();
        return;
      }
      syncHardOnLoad();
    });
    syncHardOnLoad();
  })();

  // ----- スムーズスクロール -----
  // 小さいほどゆっくり / 大きいほど速い（目安 0.05〜0.2）
  // ※ SP/タッチはネイティブスクロールを使う（wheel 劫持は PC のみ）
  // ※ header_mybuddy のおさまりは上の IIFE のみ。ここはページ位置だけ制御する
  (function () {
    var EASE = 0.08; // ホイールの速さ
    var ANCHOR_EASE = 0.04; // アンカー（PC）
    var ANCHOR_EASE_SP = 0.12; // アンカー（SP・大きいほど速い）
    var BP_PC = 920;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var current = window.scrollY;
    var target = window.scrollY;
    var running = false;
    var ease = EASE;
    var canWheelSmooth =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    function maxScroll() {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }

    function readY() {
      return window.scrollY || window.pageYOffset || 0;
    }

    // アンカーアニメだけ中断（ロゴ用の lerp / SP_SCROLL_RANGE には触れない）
    function stopAnchorScroll() {
      if (!running) return;
      running = false;
      current = target = readY();
    }

    function animate() {
      if (!running) return;
      current += (target - current) * ease;
      window.scrollTo(0, current);
      if (Math.abs(target - current) > 0.5) {
        requestAnimationFrame(animate);
      } else {
        running = false;
        current = target;
        window.scrollTo(0, current);
      }
    }

    function scrollToY(y, nextEase) {
      ease = nextEase != null ? nextEase : EASE;
      if (!running) {
        current = readY();
      }
      target = Math.max(0, Math.min(maxScroll(), y));
      if (!running) {
        running = true;
        requestAnimationFrame(animate);
      }
    }

    // ホイール（PCのみ）
    if (canWheelSmooth) {
      window.addEventListener(
        "wheel",
        function (e) {
          if (e.ctrlKey || e.target.closest(".modal_scroll, .about_modal")) return;
          e.preventDefault();
          scrollToY(target + e.deltaY, EASE);
        },
        { passive: false }
      );
    }

    // SP: 指で動かしたらアンカー自動スクロールだけ止めて、以降はネイティブ操作可能に
    window.addEventListener(
      "touchmove",
      function () {
        stopAnchorScroll();
      },
      { passive: true }
    );

    // アンカーリンク（#about / #article など）— SP/PC 共通
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;

      var id = a.getAttribute("href");
      if (!id || id === "#") return; // 空の # は無視

      var el = document.querySelector(id);
      if (!el) return;

      e.preventDefault();

      // sticky ヘッダー分を引かないと、目標位置より少し下（行き過ぎ）に見える
      var header = document.querySelector(".header");
      var headerH = header ? header.offsetHeight : 0;
      var y = el.getBoundingClientRect().top + readY() - headerH;
      var anchorEase = window.innerWidth < BP_PC ? ANCHOR_EASE_SP : ANCHOR_EASE;
      scrollToY(y, anchorEase);
    });

    // 手動スクロール時は位置を同期 / 実位置とアニメが大きくズレたら中断
    onScroll(function (y) {
      if (!running) {
        current = target = y;
        return;
      }
      if (Math.abs(y - current) > 20) {
        stopAnchorScroll();
      }
    });
  })();

  // ----- About：スクロールで動画拡大＆コンテンツ表示 -----
  // --p（0→1）を CSS に渡すだけ。見た目の調整は _about.scss の変数へ
  (function () {
    var section = document.querySelector(".about");
    if (!section) return;

    var READY = 0.5; // この進捗以上でボタン操作OK

    function update() {
      var range = section.offsetHeight - window.innerHeight;
      var p = 0;
      if (range > 0) {
        p = Math.min(1, Math.max(0, -section.getBoundingClientRect().top / range));
      }
      section.style.setProperty("--p", p);
      section.classList.toggle("is-ready", p >= READY);

      // About 見出しは動画拡大後に出現させる
      var aboutHeading = section.querySelector(".about_ttl.js-heading-reveal");
      if (aboutHeading) {
        aboutHeading.classList.toggle("is-in", p >= READY);
      }
    }

    onScroll(update);
    window.addEventListener("resize", update);
    update();
  })();
})();

// ===== About：背景動画（ミュート自動再生・ループ / SP対策） =====
(function () {
  var video = document.querySelector(".about_video");
  if (!video) return;

  function prepare() {
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.removeAttribute("controls");
  }

  function tryPlay() {
    prepare();
    if (!video.paused) return;
    var p = video.play();
    if (p && typeof p.catch === "function") {
      p.catch(function () {
        // 自動再生が弾かれても次の可視時・操作時に再試行
      });
    }
  }

  prepare();
  tryPlay();
  video.addEventListener("loadeddata", tryPlay);
  video.addEventListener("canplay", tryPlay);

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) tryPlay();
        });
      },
      { threshold: 0.15 }
    );
    io.observe(video);
  }

  // 初回ジェスチャー後に再開（iOS で autoplay が弾かれた場合）
  ["touchstart", "click", "scroll"].forEach(function (type) {
    window.addEventListener(
      type,
      function once() {
        tryPlay();
      },
      { passive: true, once: true }
    );
  });
})();

// ===== About：Movie Play → YouTube モーダル =====
(function () {
  var modal = document.getElementById("about_modal");
  var frame = modal && modal.querySelector(".about_modal_frame");
  if (!modal || !frame) return;

  // 開いたときに差し込む YouTube URL（autoplay 付き）
  var YT_SRC =
    "https://www.youtube.com/embed/pH4w-EuI0Ak?si=qcJP39kpCCGXb4g3&autoplay=1";

  function openModal() {
    frame.innerHTML =
      '<iframe src="' +
      YT_SRC +
      '" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>';
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    modal.hidden = true;
    frame.innerHTML = ""; // 再生停止のため削除
    document.body.style.overflow = "";
  }

  document.querySelectorAll("[data-about-modal-open]").forEach(function (btn) {
    btn.addEventListener("click", openModal);
  });
  document.querySelectorAll("[data-about-modal-close]").forEach(function (el) {
    el.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeModal();
  });
})();

// ===== SPメニュー開閉（Figma 605:2） =====
(function () {
  var BP_PC = 920;
  var menu = document.getElementById("sp_menu");
  var openBtn = document.querySelector(".header_menu_btn");
  var closeBtn = menu && menu.querySelector(".menu_close");
  if (!menu || !openBtn || !closeBtn) return;

  var scrollY = 0;

  function isSp() {
    return window.innerWidth < BP_PC;
  }

  function openMenu() {
    if (!isSp()) return;
    scrollY = window.scrollY || window.pageYOffset || 0;
    document.body.style.top = -scrollY + "px";
    document.body.classList.add("is-menu-open");
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden", "false");
    openBtn.setAttribute("aria-expanded", "true");
    closeBtn.focus();
  }

  function closeMenu() {
    if (!menu.classList.contains("is-open")) return;
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    openBtn.setAttribute("aria-expanded", "false");
    document.body.classList.remove("is-menu-open");
    document.body.style.top = "";
    window.scrollTo(0, scrollY);
  }

  openBtn.addEventListener("click", openMenu);
  closeBtn.addEventListener("click", closeMenu);

  // ページ内リンク：先に閉じてから既存のスムーススクロールへ
  menu.querySelectorAll(".menu_nav_link").forEach(function (link) {
    link.addEventListener("click", function (e) {
      closeMenu();
      // Top はヘッダー高さ引きで負になるため、明示的に先頭へ
      if (link.hasAttribute("data-menu-top")) {
        e.preventDefault();
        e.stopPropagation();
        window.scrollTo(0, 0);
      }
    });
  });

  // Esc で閉じる
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeMenu();
  });

  // PC幅になったら強制クローズ（レイアウト崩れ防止）
  window.addEventListener("resize", function () {
    if (!isSp()) closeMenu();
  });
})();

// ===== 表示アニメ：MyBuddy ロゴ（上部状態）＋ 見出し =====
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var logo = document.querySelector(".header_mybuddy");

  function introLogo() {
    if (!logo) return;
    logo.classList.add("is-intro");
  }

  if (reduce) {
    introLogo();
  } else {
    // 少し溜めてから主役として立ち上がる
    window.requestAnimationFrame(function () {
      window.setTimeout(introLogo, 420);
    });
  }

  var reveals = document.querySelectorAll(".js-scroll-reveal");
  var headings = document.querySelectorAll(".js-heading-reveal");
  var staggers = document.querySelectorAll(".js-scroll-stagger");

  function setStagger(list, on) {
    list.classList.toggle("is-in", on);
    list.querySelectorAll(".js-scroll-reveal").forEach(function (el) {
      el.classList.toggle("is-in", on);
    });
  }

  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) {
      el.classList.add("is-in");
    });
    headings.forEach(function (el) {
      el.classList.add("is-in");
    });
    staggers.forEach(function (list) {
      setStagger(list, true);
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        // 画面より背の高い要素は threshold に届かず不安定になるため、
        // .js-scroll-reveal--once は一度入ったら表示を維持する
        if (entry.target.classList.contains("js-scroll-reveal--once")) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
          return;
        }
        // それ以外は画面外に出たら戻す（上下どちらからでも再表示）
        entry.target.classList.toggle("is-in", entry.isIntersecting);
      });
    },
    {
      root: null,
      rootMargin: "0px 0px -12% 0px",
      threshold: 0,
    }
  );

  // スタッガー内の子は親で一括制御するため個別監視しない
  reveals.forEach(function (el) {
    if (el.closest(".js-scroll-stagger")) return;
    observer.observe(el);
  });

  // 見出しは専用クラスで監視（About は動画進捗側）
  headings.forEach(function (el) {
    if (el.classList.contains("about_ttl")) return;
    observer.observe(el);
  });

  var staggerObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        setStagger(entry.target, entry.isIntersecting);
      });
    },
    {
      root: null,
      rootMargin: "0px 0px -10% 0px",
      threshold: 0.15,
    }
  );

  staggers.forEach(function (list) {
    staggerObserver.observe(list);
  });
})();

// ===== Footer walk：official が見えはじめたら歩行開始 =====
(function () {
  var walk = document.querySelector(".footer_walk");
  var men = walk && walk.querySelector(".footer_walk_men");
  var official = document.querySelector(".official");
  if (!walk || !official) return;

  var active = false;

  function restartWalk() {
    if (!men) return;
    men.style.animation = "none";
    void men.offsetWidth;
    men.style.animation = "";
  }

  function setActive(next) {
    if (next === active) return;
    if (next) {
      restartWalk();
      walk.classList.add("is-active");
    } else {
      walk.classList.remove("is-active");
      restartWalk();
    }
    active = next;
  }

  if (!("IntersectionObserver" in window)) {
    setActive(true);
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          setActive(true);
          return;
        }

        // 上に戻って official がまだ画面下にある場合だけ停止
        var rect = official.getBoundingClientRect();
        var vh = window.innerHeight || document.documentElement.clientHeight;
        if (rect.top > vh) {
          setActive(false);
        }
      });
    },
    {
      root: null,
      threshold: 0,
      rootMargin: "0px",
    }
  );

  observer.observe(official);
})();


// document.addEventListener("DOMContentLoaded", function () {
//   var mvSlider = document.querySelector(".mv_slider");
//   if (!mvSlider) return;

//   var BP_PC = 920; // Sassの pc と同じ

//   function isPc() {
//     return window.innerWidth >= BP_PC;
//   }

//   // pcVw相当（カンプ1440基準）
//   function pcVw(value) {
//     return (value / 1440) * 100 + "vw";
//   }

//   // SwiperのspaceBetweenはpx数値のみ受け取るため換算
//   function pcVwToPx(value) {
//     return (window.innerWidth * value) / 1440;
//   }

//   // PC: 中央幅（vw） / SP: 1枚（100%）
//   function setSlideWidth() {
//     mvSlider.querySelectorAll(".mv_slider_item").forEach(function (slide) {
//       slide.style.width = isPc() ? pcVw(877) : "100%"; // 877 / 1440 * 100vw
//     });
//   }

//   setSlideWidth();

//   // PCは従来どおり / SPだけ1枚
//   var swiper = new Swiper(".mv_slider", {
//     loop: true,
//     speed: 1200,
//     slidesPerView: isPc() ? "auto" : 1,
//     spaceBetween: isPc() ? pcVwToPx(23) : 0, // gap = pcVw(23)
//     centeredSlides: isPc(),
//     autoplay: {
//       delay: 3000,
//       disableOnInteraction: false,
//     },
//   });

//   window.addEventListener("resize", function () {
//     setSlideWidth();
//     swiper.params.slidesPerView = isPc() ? "auto" : 1;
//     swiper.params.spaceBetween = isPc() ? pcVwToPx(23) : 0;
//     swiper.params.centeredSlides = isPc();
//     swiper.update();
//   });
// });