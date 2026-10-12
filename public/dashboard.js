/* Saffron & Co. — Staff dashboard */
(function () {
  "use strict";

  var TOKEN_KEY = "saffron_admin_token";

  var els = {
    login: document.getElementById("dashLogin"),
    loginForm: document.getElementById("loginForm"),
    passcode: document.getElementById("passcode"),
    loginMsg: document.getElementById("loginMsg"),
    app: document.getElementById("dashApp"),
    status: document.getElementById("dashStatus"),
    refreshBtn: document.getElementById("refreshBtn"),
    lockBtn: document.getElementById("lockBtn"),
    statReservations: document.getElementById("statReservations"),
    statUpcoming: document.getElementById("statUpcoming"),
    statGuests: document.getElementById("statGuests"),
    statSubscribers: document.getElementById("statSubscribers"),
    resBody: document.getElementById("resBody"),
    resSearch: document.getElementById("resSearch"),
    subList: document.getElementById("subList"),
  };

  var cache = { reservations: [], subscribers: [] };

  function getToken() {
    try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
  }
  function setToken(t) {
    try { sessionStorage.setItem(TOKEN_KEY, t); } catch (e) {}
  }
  function clearToken() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showView(view) {
    if (view === "app") {
      els.login.hidden = true;
      els.app.hidden = false;
    } else {
      els.app.hidden = true;
      els.login.hidden = false;
      if (els.passcode) els.passcode.focus();
    }
  }

  function setStatus(msg, kind) {
    els.status.textContent = msg || "";
    els.status.className = "dash-status" + (kind ? " " + kind : "");
  }

  // Fetch helper that injects the admin passcode header.
  function api(path) {
    return fetch(path, { headers: { "x-admin-token": getToken() } }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function renderStats(s) {
    els.statReservations.textContent = s.totalReservations;
    els.statUpcoming.textContent = s.upcoming;
    els.statGuests.textContent = s.totalGuests;
    els.statSubscribers.textContent = s.totalSubscribers;
  }

  function renderReservations() {
    var q = (els.resSearch.value || "").trim().toLowerCase();
    var rows = cache.reservations.filter(function (r) {
      if (!q) return true;
      return (
        (r.name || "").toLowerCase().indexOf(q) !== -1 ||
        (r.email || "").toLowerCase().indexOf(q) !== -1
      );
    });

    if (!rows.length) {
      els.resBody.innerHTML =
        '<tr class="dash-empty"><td colspan="6">' +
        (cache.reservations.length ? "No matches." : "No reservations yet.") +
        "</td></tr>";
      return;
    }

    els.resBody.innerHTML = rows
      .map(function (r) {
        var contact =
          esc(r.email) + (r.phone ? "<br><span class='muted'>" + esc(r.phone) + "</span>" : "");
        return (
          "<tr>" +
          "<td data-label='Name'>" + esc(r.name) + "</td>" +
          "<td data-label='Contact'>" + contact + "</td>" +
          "<td data-label='Date'>" + esc(r.date) + "</td>" +
          "<td data-label='Time'>" + esc(r.time) + "</td>" +
          "<td data-label='Guests'>" + esc(r.guests) + "</td>" +
          "<td data-label='Requests' class='muted'>" + (r.requests ? esc(r.requests) : "—") + "</td>" +
          "</tr>"
        );
      })
      .join("");
  }

  function renderSubscribers() {
    if (!cache.subscribers.length) {
      els.subList.innerHTML = '<li class="dash-empty">No subscribers yet.</li>';
      return;
    }
    els.subList.innerHTML = cache.subscribers
      .map(function (s) {
        return (
          "<li>" +
          "<span class='sub-email'>" + esc(s.email) + "</span>" +
          "<span class='sub-date muted'>" + esc((s.created_at || "").slice(0, 10)) + "</span>" +
          "</li>"
        );
      })
      .join("");
  }

  function handleUnauthorized() {
    clearToken();
    setStatus("");
    showView("login");
    els.loginMsg.textContent = "Your session expired. Please enter the passcode again.";
  }

  function loadAll() {
    setStatus("Loading…", "muted");
    els.refreshBtn.disabled = true;

    return Promise.all([
      api("/api/admin/stats"),
      api("/api/admin/reservations"),
      api("/api/admin/subscribers"),
    ])
      .then(function (out) {
        var unauthorized = out.filter(function (r) { return r.status === 401; });
        if (unauthorized.length) {
          handleUnauthorized();
          return;
        }
        var failed = out.filter(function (r) { return !r.ok; });
        if (failed.length) {
          var msg = (failed[0].data && failed[0].data.error) || "Could not load dashboard data.";
          setStatus(msg, "error");
          return;
        }

        renderStats(out[0].data);
        cache.reservations = out[1].data.reservations || [];
        cache.subscribers = out[2].data.subscribers || [];
        renderReservations();
        renderSubscribers();

        var when = new Date().toLocaleTimeString();
        setStatus("Updated at " + when, "muted");
      })
      .catch(function (err) {
        console.error(err);
        setStatus("Network error. Please try again.", "error");
      })
      .finally(function () {
        els.refreshBtn.disabled = false;
      });
  }

  els.loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var code = (els.passcode.value || "").trim();
    if (!code) return;
    setToken(code);
    els.loginMsg.textContent = "Checking…";

    api("/api/admin/stats")
      .then(function (r) {
        if (r.status === 401) {
          clearToken();
          els.loginMsg.textContent = "Incorrect passcode. Try again.";
          els.passcode.select();
          return;
        }
        els.loginMsg.textContent = "";
        els.passcode.value = "";
        showView("app");
        loadAll();
      })
      .catch(function () {
        clearToken();
        els.loginMsg.textContent = "Network error. Please try again.";
      });
  });

  els.refreshBtn.addEventListener("click", loadAll);

  els.lockBtn.addEventListener("click", function () {
    clearToken();
    cache.reservations = [];
    cache.subscribers = [];
    showView("login");
  });

  els.resSearch.addEventListener("input", renderReservations);

  // Auto-load if a token is already present in this tab session.
  if (getToken()) {
    showView("app");
    loadAll();
  } else {
    showView("login");
  }
})();
