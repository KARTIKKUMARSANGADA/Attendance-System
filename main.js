    // Determine API_BASE dynamically based on the environment
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    // TODO: Replace the URL below with your actual Render URL after deployment
    const PROD_API_BASE = import.meta.env.VITE_BACKEND_URL || 'https://your-render-backend-url.onrender.com';
    const API_BASE = isLocalhost ? 'http://localhost:8002' : PROD_API_BASE;
    const API_ATTENDANCE = `${API_BASE}/api/attendance`;
    const API_PROFILE = `${API_BASE}/api/profile`;
    const API_PUNCHES = `${API_BASE}/api/punches`;
    const STORAGE_KEY = 'pms_token';
    const TARGET_EFFECTIVE_SECONDS = 8 * 3600;

    let liveTimerId = null;
    let employeeId = null;
    window.employeeNumericId = null;

    function getToken() {
      const hash = window.location.hash;
      if (hash.includes('access_token=')) {
        const token = hash.split('access_token=')[1].split('&')[0];
        localStorage.setItem(STORAGE_KEY, token);
        window.location.hash = '';
        return token;
      }
      return localStorage.getItem(STORAGE_KEY) || '';
    }

    const els = {
      card: document.getElementById('card'),
      clockIn: document.getElementById('clock-in'),
      clockOut: document.getElementById('clock-out'),
      effectiveHours: document.getElementById('effective-hours'),
      breakHours: document.getElementById('break-hours'),
      grossHours: document.getElementById('gross-hours'),
      status: document.getElementById('status'),
      remaining: document.getElementById('remaining'),
      completeAt: document.getElementById('complete-at'),
      progressFill: document.getElementById('progress-fill'),
    };

    function getHeaders() {
      const token = getToken();
      return {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      };
    }

    var profileData = null;

    function setProfilePopoverContent(data) {
      const pop = document.getElementById('profile-popover');
      if (!pop) return;
      if (!data || !data.firstName) {
        pop.innerHTML = '';
        return;
      }
      const name = (data.firstName || '').trim() + ' ' + (data.lastName || '').trim();
      const role = 'Employee';
      const meta = 'Brainerhub';
      const email = (data.emailId || '').trim();
      var html = '<div class="popover-name">' + escapeHtml(name) + '</div>';
      html += '<div class="popover-role">' + escapeHtml(role) + '</div>';
      html += '<div class="popover-meta">' + escapeHtml(meta) + '</div>';
      if (email) html += '<div class="popover-row">' + escapeHtml(email) + '</div>';
      pop.innerHTML = html;
    }
   
    function escapeHtml(s) {
      var div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    function positionProfilePopover() {
      const trigger = document.getElementById('profile-trigger');
      const pop = document.getElementById('profile-popover');
      if (!trigger || !pop || !pop.classList.contains('visible')) return;
      const tr = trigger.getBoundingClientRect();
      const pad = 8;
      var left = tr.right - pop.offsetWidth;
      if (left < pad) left = pad;
      if (left + pop.offsetWidth > window.innerWidth - pad) left = window.innerWidth - pop.offsetWidth - pad;
      var top = tr.bottom + pad;
      if (top + pop.offsetHeight > window.innerHeight - pad) top = tr.top - pop.offsetHeight - pad;
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
    }

    function renderProfile(data) {
      profileData = data;
      const trigger = document.getElementById('profile-trigger');
      const avatarWrap = document.getElementById('profile-avatar');
      const nameEl = document.getElementById('profile-trigger-name');
      if (!trigger || !avatarWrap) return;

      if (!data || !data.firstName) {
        trigger.classList.add('profile-empty');
        trigger.classList.remove('profile-loading');
        setProfilePopoverContent(null);
        return;
      }

      trigger.classList.remove('profile-empty', 'profile-loading');
      const name = ((data.firstName || '').trim() + ' ' + (data.lastName || '').trim()) || '—';
      nameEl.textContent = name;
      setProfilePopoverContent(data);

      var firstLetter = name !== '—' ? name.charAt(0).toUpperCase() : '—';
      
      var span = avatarWrap.querySelector('#profile-initial');
      if (!span) {
        span = document.createElement('span');
        span.id = 'profile-initial';
        avatarWrap.appendChild(span);
      }
      span.textContent = firstLetter;
    }

    async function fetchProfile() {
      const trigger = document.getElementById('profile-trigger');
      if (!trigger) return;
      trigger.classList.remove('profile-empty');
      trigger.classList.add('profile-loading');

      try {
        const res = await fetch(API_PROFILE, { method: 'GET', headers: getHeaders() });
        if (!res.ok) {
          renderProfile(null);
          return;
        }
        const json = await res.json();
        const data = (json && json.data) ? json.data : null;
        if (data && data.employeeId) {
            employeeId = data.employeeId;
        }
        if (data && data.employeeCode) {
            window.employeeNumericId = data.employeeCode;
        }
        renderProfile(data);
        
        if (employeeId) {
            fetchSummary();
        }
      } catch (e) {
        renderProfile(null);
      }
    }

    function attachProfilePopover() {
      var trigger = document.getElementById('profile-trigger');
      var pop = document.getElementById('profile-popover');
      if (!trigger || !pop) return;
      var hideTimeout = null;
      trigger.addEventListener('mouseenter', function () {
        if (hideTimeout) clearTimeout(hideTimeout);
        if (!profileData) return;
        pop.classList.add('visible');
        pop.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(function () { positionProfilePopover(); });
      });
      trigger.addEventListener('mouseleave', function () {
        hideTimeout = setTimeout(function () {
          pop.classList.remove('visible');
          pop.setAttribute('aria-hidden', 'true');
        }, 100);
      });
      pop.addEventListener('mouseenter', function () {
        if (hideTimeout) clearTimeout(hideTimeout);
      });
      pop.addEventListener('mouseleave', function () {
        hideTimeout = setTimeout(function () {
          pop.classList.remove('visible');
          pop.setAttribute('aria-hidden', 'true');
        }, 100);
      });
    }

    function formatTime(date) {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '—';
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      const s = date.getSeconds().toString().padStart(2, '0');
      return `${h}:${m}:${s}`;
    }

    function formatTime12(date) {
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '—';
      const h24 = date.getHours();
      const h12 = h24 % 12 || 12;
      const m = date.getMinutes().toString().padStart(2, '0');
      const s = date.getSeconds().toString().padStart(2, '0');
      const ampm = h24 < 12 ? 'AM' : 'PM';
      return h12 + ':' + m + ':' + s + ' ' + ampm;
    }

    function formatDayLabel(attendanceDate) {
      if (!attendanceDate) return '—';
      const d = typeof attendanceDate === 'string' ? new Date(attendanceDate) : attendanceDate;
      if (isNaN(d.getTime())) return '—';
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()];
    }

    var TARGET_HOURS = 8;
    var TARGET_MET_LABELS = ['Good boy 👍', 'Target crushed 💪', 'Nailed it 🔥', '8h done ✅', 'On point 👌'];
    var TARGET_BELOW_LABELS = ['So close 😅', 'Regrets, we have a few 😔', 'Almost there next time 💪', 'Short by a bit 📉', 'Tomorrow we rise 🌅'];

    var HINGLISH_HOVER = {
      'target-met': ['Kya baat hai! Boss khush! 💪', 'Seedha promotion ki taraf!', 'Bohot hard, legend ban gaya!', 'Yeh din toh aise hi hona tha!', 'Company ko tumse pyaar hai ab'],
      'below-target': ['Arre yaar, next time pakka!', 'Chalo koi na, kal try karenge 😅', 'Thoda aur rehna tha na!', 'Aaram bhi zaroori hai yaar', 'Regret mat karo, Monday fresh start'],
      'worked': ['Abhi kaam chal raha hai!', 'Focus mode on, chai break le aana', 'Clocked in = officially busy 😎', 'Kaam khatam karke hi niklenge'],
      'off': ['Aaj rest day, kya karen!', 'Weekend vibes only 🌴', 'Company ne diya hai off, enjoy karo', 'No guilt, proper break'],
      'none': ['Entry hi nahi hai? Kahi bhool toh nahi gaye?', 'Punch kiya tha ya nahi? 🤔', 'Aaj leave tha kya ya system glitch?']
    };

    function getStatusHoverQuote(cls, record) {
      var list = HINGLISH_HOVER[cls] || HINGLISH_HOVER['worked'];
      if (!list.length) return '';
      var dateStr = (record && record.date) ? record.date.toString() : '';
      var idx = 0;
      for (var i = 0; i < dateStr.length; i++) idx += dateStr.charCodeAt(i);
      return list[idx % list.length];
    }

    function parseHHMM(str) {
      if (!str) return 0;
      const parts = str.split(':');
      if (parts.length < 2) return 0;
      return (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60);
    }

    function getDayStatus(record) {
      if (!record) return { text: '—', cls: 'none' };
      var effectiveSeconds = parseHHMM(record.totalAttendedHours);
      if (record.attendanceOk === 0 && effectiveSeconds === 0) return { text: 'W-OFF', cls: 'off' };
      if (effectiveSeconds === 0) return { text: 'No entries', cls: 'none' };
      if (effectiveSeconds >= TARGET_HOURS * 3600) {
        var dateStr = (record.date || '').toString();
        var idx = 0;
        for (var i = 0; i < dateStr.length; i++) idx += dateStr.charCodeAt(i);
        idx = idx % TARGET_MET_LABELS.length;
        return { text: TARGET_MET_LABELS[idx], cls: 'target-met' };
      }
      
      const isToday = new Date(record.date).toDateString() === new Date().toDateString();
      if (isToday) return { text: 'Clocked In', cls: 'worked' };
      
      var dateStr = (record.date || '').toString();
      var idx = 0;
      for (var i = 0; i < dateStr.length; i++) idx += dateStr.charCodeAt(i);
      idx = idx % TARGET_BELOW_LABELS.length;
      return { text: TARGET_BELOW_LABELS[idx], cls: 'below-target' };
    }

    function formatDuration(seconds) {
      if (seconds == null || isNaN(seconds)) return '—';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      return [h, m, s].map(n => n.toString().padStart(2, '0')).join(':');
    }

    function renderError(message) {
      els.card.classList.add('error-card');
      els.clockIn.textContent = '—';
      els.clockOut.textContent = '—';
      els.effectiveHours.textContent = '—';
      els.breakHours.textContent = '—';
      els.grossHours.textContent = '—';
      els.status.textContent = 'Error';
      els.status.className = 'status none';
      els.status.title = message;
      if (els.remaining) els.remaining.textContent = '—';
      if (els.completeAt) els.completeAt.textContent = '—';
      updateProgress(0);
    }

    function stopLiveTimer() {
      if (liveTimerId != null) {
        clearInterval(liveTimerId);
        liveTimerId = null;
      }
    }

    function updateProgress(effectiveSecs) {
      if (els.progressFill) {
        const pct = Math.min(100, (effectiveSecs / TARGET_EFFECTIVE_SECONDS) * 100);
        els.progressFill.style.width = pct + '%';
        var bar = els.progressFill && els.progressFill.parentElement;
        if (bar) bar.setAttribute('aria-valuenow', Math.round(pct));
      }
    }

    function renderRecentDays(list) {
      const container = document.getElementById('recent-days-list');
      if (!container) return;
      if (!list || list.length === 0) {
        container.innerHTML = '<p class="recent-days-empty">No recent records</p>';
        return;
      }
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      
      const sorted = list.filter(d => new Date(d.date) <= now).slice().sort(function (a, b) {
        return new Date(b.date) - new Date(a.date);
      });
      const recent = sorted.slice(0, 10);
      const rows = [
        '<div class="day-row header"><span class="day-date">Date</span><span class="day-effective">Effective</span><span class="day-gross">Gross</span><span class="day-break">Break</span><span>Status</span></div>',
      ];
      recent.forEach(function (record) {
        const effectiveSecs = parseHHMM(record.totalAttendedHours);
        const effective = effectiveSecs > 0 ? formatDuration(effectiveSecs) : '00:00:00';
        
        // Use punch-enriched data if available, else show '—'
        const gross = record._grossSecs != null ? formatDuration(record._grossSecs) : '—';
        const breakVal = record._breakSecs != null ? formatDuration(record._breakSecs) : '—';
        
        const status = getDayStatus(record);
        const hoverQuote = getStatusHoverQuote(status.cls, record);
        const safeQuote = (hoverQuote || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        rows.push(
          '<div class="day-row status-' + status.cls + '">' +
            '<span class="day-date">' + formatDayLabel(record.date) + '</span>' +
            '<span class="day-effective">' + effective + '</span>' +
            '<span class="day-gross">' + gross + '</span>' +
            '<span class="day-break">' + breakVal + '</span>' +
            '<span class="day-status-mini ' + status.cls + '" data-hover-quote="' + safeQuote + '">' + status.text + '</span>' +
          '</div>'
        );
      });
      container.innerHTML = rows.join('');
      attachStatusTooltip(); if(window.lucide) lucide.createIcons();
    }

    function calcGrossBreakFromPunches(punches, useNowAsLastOut) {
      if (!punches || punches.length === 0) return { grossSecs: null, breakSecs: null };
      const valid = punches.filter(p => p.in && p.in !== 'Missing');
      if (valid.length === 0) return { grossSecs: null, breakSecs: null };

      valid.sort((a, b) => new Date(a.in) - new Date(b.in));

      const now = new Date();
      // Effective = sum of all in→out intervals (use now for open session if today)
      let effectiveSecs = 0;
      valid.forEach(p => {
        const outTime = (p.out && p.out !== 'Missing') ? new Date(p.out) : (useNowAsLastOut ? now : null);
        if (outTime) {
          effectiveSecs += Math.max(0, Math.floor((outTime - new Date(p.in)) / 1000));
        }
      });

      const firstIn = new Date(valid[0].in);
      const last = valid[valid.length - 1];
      const lastOut = (last.out && last.out !== 'Missing') ? new Date(last.out) : (useNowAsLastOut ? now : null);

      if (!lastOut) return { grossSecs: null, breakSecs: null };

      const grossSecs = Math.max(0, Math.floor((lastOut - firstIn) / 1000));
      const breakSecs = Math.max(0, grossSecs - effectiveSecs);
      return { grossSecs, breakSecs };
    }

    var statusTooltipTimeout = null;

    function attachStatusTooltip() {
      var listEl = document.getElementById('recent-days-list');
      var tooltipEl = document.getElementById('status-tooltip');
      if (!listEl || !tooltipEl) return;
      listEl.removeEventListener('mouseover', onStatusMouseOver);
      listEl.removeEventListener('mouseout', onStatusMouseOut);
      listEl.addEventListener('mouseover', onStatusMouseOver);
      listEl.addEventListener('mouseout', onStatusMouseOut);
    }

    function onStatusMouseOver(e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('day-status-mini')) return;
      var quote = t.getAttribute('data-hover-quote');
      if (!quote) return;
      var tooltipEl = document.getElementById('status-tooltip');
      if (!tooltipEl) return;
      if (statusTooltipTimeout) clearTimeout(statusTooltipTimeout);
      statusTooltipTimeout = setTimeout(function () {
        statusTooltipTimeout = null;
        tooltipEl.textContent = quote.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        tooltipEl.setAttribute('aria-hidden', 'false');
        var rect = t.getBoundingClientRect();
        var w = tooltipEl.offsetWidth;
        var h = tooltipEl.offsetHeight;
        var left = rect.left + (rect.width / 2) - (w / 2);
        var top = rect.top - h - 8;
        if (left < 8) left = 8;
        if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
        if (top < 8) top = rect.bottom + 8;
        tooltipEl.style.left = left + 'px';
        tooltipEl.style.top = top + 'px';
        tooltipEl.classList.add('visible');
      }, 120);
    }

    function onStatusMouseOut(e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('day-status-mini')) return;
      if (statusTooltipTimeout) {
        clearTimeout(statusTooltipTimeout);
        statusTooltipTimeout = null;
      }
      var tooltipEl = document.getElementById('status-tooltip');
      if (tooltipEl) {
        tooltipEl.classList.remove('visible');
        tooltipEl.setAttribute('aria-hidden', 'true');
      }
    }

    async function fetchSummary() {
      els.card.classList.remove('error-card');
      els.card.classList.add('loading');
      els.status.textContent = 'Loading…';
      els.status.className = 'status none';

      try {
        const headers = getHeaders();
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const d_str = y + '-' + m.toString().padStart(2, '0') + '-' + now.getDate().toString().padStart(2, '0');
        
        // Fetch monthly attendance history
        const aRes = await fetch(`${API_ATTENDANCE}?employeeId=${employeeId}&month=${m}&year=${y}`, { headers });
        const aJson = await aRes.json();
        const historyList = aJson.data || [];

        // Get last 10 working days (exclude today — handled separately)
        const cutoff = new Date(); cutoff.setHours(23,59,59,999);
        const recentDays = historyList
          .filter(d => new Date(d.date) <= cutoff)
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 10);

        // Fetch today's punches for live card
        const punchUrl = window.employeeNumericId 
            ? `${API_PUNCHES}?id=${window.employeeNumericId}&date=${d_str}`
            : `${API_PUNCHES}?employeeId=${employeeId}&date=${d_str}`;

        // Fetch punches for all recent days + today in parallel
        const punchFetches = recentDays.map(record => {
          const rDate = record.date ? record.date.slice(0,10) : d_str;
          const url = window.employeeNumericId 
            ? `${API_PUNCHES}?id=${window.employeeNumericId}&date=${rDate}`
            : `${API_PUNCHES}?employeeId=${employeeId}&date=${rDate}`;
          return fetch(url, { headers })
            .then(r => r.json())
            .then(j => ({ date: rDate, punches: (j && j.data) ? j.data : (Array.isArray(j) ? j : []) }))
            .catch(() => ({ date: rDate, punches: [] }));
        });

        const todayPunchFetch = fetch(punchUrl, { headers })
          .then(r => r.json())
          .then(j => (j && j.data) ? j.data : (Array.isArray(j) ? j : []))
          .catch(() => []);

        // Run all punch fetches in parallel
        const [allDayPunches, todayPunches] = await Promise.all([
          Promise.all(punchFetches),
          todayPunchFetch
        ]);

        // Enrich history records with computed Gross & Break from punch data
        const punchMap = {};
        allDayPunches.forEach(r => { punchMap[r.date] = r.punches; });
        recentDays.forEach(record => {
          const rDate = record.date ? record.date.slice(0,10) : null;
          const dayPunches = rDate ? (punchMap[rDate] || []) : [];
          const isToday = rDate === d_str;
          const { grossSecs, breakSecs } = calcGrossBreakFromPunches(dayPunches, isToday);
          record._grossSecs = grossSecs;
          record._breakSecs = breakSecs;
        });

        renderRecentDays(historyList);
        renderToday(todayPunches);
        els.card.classList.remove('loading');

      } catch (err) {
        stopLiveTimer();
        renderError(err.message);
        console.error('Attendance fetch error:', err);
      }
    }

    function renderToday(punches) {
        stopLiveTimer();
        if (!punches || punches.length === 0) {
            els.clockIn.textContent = '—';
            els.clockOut.textContent = '—';
            els.effectiveHours.textContent = '—';
            els.breakHours.textContent = '—';
            els.grossHours.textContent = '—';
            els.status.textContent = 'No Punch';
            els.status.className = 'status none';
            if (els.remaining) els.remaining.textContent = '—';
            if (els.completeAt) els.completeAt.textContent = '—';
            updateProgress(0);
            return;
        }

        punches.sort((a, b) => new Date(a.in) - new Date(b.in));
        
        const first = punches[0];
        const last = punches[punches.length - 1];

        const firstIn = (first.in && first.in !== 'Missing') ? new Date(first.in) : null;
        if (firstIn) {
            els.clockIn.textContent = formatTime(firstIn);
        } else {
            els.clockIn.textContent = '—';
        }

        const isCurrentlyClockedIn = (!last.out || last.out === 'Missing');

        if (!isCurrentlyClockedIn) {
            els.clockOut.textContent = formatTime(new Date(last.out));
            els.status.textContent = 'Clocked Out';
            els.status.className = 'status clocked-out';
        } else {
            els.clockOut.textContent = '—';
            els.status.textContent = 'Clocked In';
            els.status.className = 'status clocked-in';
        }

        function calculateMetrics() {
            let totalEffectiveMs = 0;
            const now = new Date();
            
            punches.forEach(p => {
                if (p.in && p.in !== 'Missing') {
                    const start = new Date(p.in);
                    const end = (p.out && p.out !== 'Missing') ? new Date(p.out) : now;
                    totalEffectiveMs += (end - start);
                }
            });

            const effectiveSecs = Math.max(0, Math.floor(totalEffectiveMs / 1000));
            const grossSecs = firstIn ? Math.max(0, Math.floor((now - firstIn) / 1000)) : 0;
            let breakSecs = grossSecs - effectiveSecs;
            if (breakSecs < 0) breakSecs = 0;

            if (!isCurrentlyClockedIn && last.out && last.out !== 'Missing') {
                const finalGrossSecs = firstIn ? Math.max(0, Math.floor((new Date(last.out) - firstIn) / 1000)) : 0;
                breakSecs = finalGrossSecs - effectiveSecs;
                if (breakSecs < 0) breakSecs = 0;
                els.grossHours.textContent = formatDuration(finalGrossSecs);
            } else {
                els.grossHours.textContent = formatDuration(grossSecs);
            }

            els.effectiveHours.textContent = formatDuration(effectiveSecs);
            els.breakHours.textContent = formatDuration(breakSecs);

            updateProgress(effectiveSecs);

            const remainingSecs = Math.max(0, TARGET_EFFECTIVE_SECONDS - effectiveSecs);
            if (els.remaining) {
                els.remaining.textContent = remainingSecs > 0 ? formatDuration(remainingSecs) : 'Done';
                els.remaining.classList.toggle('done', remainingSecs <= 0);
            }
            if (els.completeAt) {
                if (remainingSecs > 0) {
                    const completeAtTime = new Date(now.getTime() + remainingSecs * 1000);
                    els.completeAt.textContent = formatTime12(completeAtTime);
                } else {
                    els.completeAt.textContent = '—';
                }
            }
        }

        calculateMetrics();

        if (isCurrentlyClockedIn) {
            liveTimerId = setInterval(calculateMetrics, 1000);
        }
    }

    document.getElementById('token-save').onclick = () => {
      const val = document.getElementById('token-input').value;
      if (val) { localStorage.setItem(STORAGE_KEY, val); fetchProfile(); }
    };

    fetchProfile();
    attachProfilePopover();
