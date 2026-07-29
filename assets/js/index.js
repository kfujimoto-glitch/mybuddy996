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


// ===== MVスライダー =====
(function () {
  // PCカンプ数値（ここを変える）
  var MV_CAMP_WIDTH = 1440; // Swiper全体の幅
  var MV_SLIDE_WIDTH = 877; // スライド幅
  var MV_SPACE = 23; // スライド間余白

  // （全体幅 ＋ 余白）÷（スライド幅 ＋ 余白）
  // 例: (1440 + 23) / (877 + 23) ≒ 1.6256
  var mvSlidesPerView =
    (MV_CAMP_WIDTH + MV_SPACE) / (MV_SLIDE_WIDTH + MV_SPACE);

  // 1スライドの表示時間（ページャーのリング一周と同期）
  var MV_AUTOPLAY_DELAY = 3000;

  new Swiper(".mv_slider", {
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
    pagination: {
      el: ".mv_slider_pager",
      clickable: true,
      renderBullet: function (index, className) {
        return (
          '<button type="button" class="' +
          className +
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
      },
    },
    breakpoints: {
      // PC（カンプ計算結果を反映）
      920: {
        slidesPerView: mvSlidesPerView,
        spaceBetween: MV_SPACE,
        centeredSlides: true,
      },
    },
  });

  // ページャーのリング一周時間を autoplay と同期
  var mvPagerEl = document.querySelector(".mv_slider_pager");
  if (mvPagerEl) {
    mvPagerEl.style.setProperty("--mv-pager-duration", MV_AUTOPLAY_DELAY + "ms");
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
    var WIDTH_LARGE = 495; // 元の幅（変えない）
    var WIDTH_SMALL = 178; // コンパクト時の幅（変えない）
    var MARGIN_TOP_LARGE = 6;
    var SCROLL_RANGE = 180; // この距離で縮小完了（大きいほどゆっくり）
    var DEADZONE = 2; // これ未満は「一番上」扱い（リロード時の微小スクロール対策）

    var header = document.querySelector(".header");
    var logo = document.querySelector(".header_mybuddy");
    if (!header || !logo) return;

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

    // CSS の min(pcCalc(n), n px) と同じ実寸
    function campToPx(value) {
      return Math.min((value / CAMP) * window.innerWidth, value);
    }

    function normalizeY(scrollY) {
      return scrollY < DEADZONE ? 0 : scrollY;
    }

    function apply(scrollY) {
      scrollY = normalizeY(scrollY);

      if (window.innerWidth < BP_PC) {
        header.classList.remove("is-compact");
        logo.style.width = "";
        logo.style.maxWidth = "";
        logo.style.top = "";
        logo.style.marginTop = "";
        logo.style.transform = "";
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

      // ほぼ縮みきったらヘッダー背景・padding を切り替え
      header.classList.toggle("is-compact", progress > 0.85);
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
      // 慣性を少し持たせて広がりをなめらかに（参考サイト同様）
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

    onScroll(onHeaderScroll);
    window.addEventListener("resize", syncStyles);
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
  (function () {
    var EASE = 0.08; // ホイールの速さ
    var ANCHOR_EASE = 0.04; // アンカーリンクの速さ
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

    function animate() {
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
      var y = el.getBoundingClientRect().top + window.scrollY - headerH;
      scrollToY(y, ANCHOR_EASE);
    });

    // 手動スクロール時は位置を同期
    onScroll(function (y) {
      if (!running) current = target = y;
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
