    const global = window;
    // jQuery-like syntactic sugar. Only queries for one element. Does not loop over multiple like jQuery
    const $ = (query, ...args) => {
      if (typeof query === 'undefined') throw 'No query provided to $';

      const $targetEl = args[0];

      var el;
      if (typeof query.nodeType === 'string') {
        el = query;
      } else if (query[0] === '<') {
        const container = document.createElement('div');
        container.innerHTML = query;
        el = container.firstChild;
      } else if (typeof query === 'string') {
        el = ($targetEl || document).querySelector(query);
      } else {
        el = query;
      }

      if (el) {
        el.on = (e, fn, ...args) => {
          if (args.length > 0) {
            el.addEventListener(e, fn, ...args);
          } else {
            el.addEventListener(e, fn, false);
          }

          return el;
        };

        el.off = (eventType, callback) => { el.removeEventListener(eventType, callback); return el; }

        el.once = (e, fn) => el.addEventListener(e, fn, {once: true});

        el.trigger = (eventType, detail) => {
          detail = detail ? { detail: detail } : undefined;
          const e = new CustomEvent(eventType, detail);
          el.dispatchEvent(e);

          return el;
        };

        el.hasClass =    c => el.classList.contains(c);
        el.addClass =    c => { el.classList.add(c); return el; }
        el.removeClass = c => { el.classList.remove(c); return el; }
        el.toggleClass = c => { el.classList.toggle(c); return el; }
        el.append = element => { el.appendChild($(element)); return el; }
        el.remove = () => { el.parentNode.removeChild(el); return el; }
        el.show = () => { el.style.display = 'initial'; return el; }
        el.attr = (name, val) => {
          if (isUndefined(val)) {
            return el.getAttribute(name);
          } else {
            el.setAttribute(name, val);
            return el;
          }
        };
        el.removeAttr = name => { el.removeAttribute(name); return el; }
        el.val = (v) => (!isUndefined(v) ? el.value = v : el.value);
        el.find = q => $(q, el);
        el.html = h => {
          if (isUndefined(h)) {
            return el.innerHTML;
          } else {
            el.innerHTML = h;
            return el;
          }
        };
      }

      const isUndefined = (v) => typeof v === 'undefined';

      return el;
    }
    global.$ = $;

    const delay = (ms, fn) => {
      fn = fn || (() => {});

      const p = new Promise((resolve) => {
        setTimeout(() => resolve(fn()), ms);
      });

      return p;
    }
    global.delay = delay;

    const throttle = (fn, wait, opts) => {
      var context, args, result;
      var timeout = null;
      var previous = 0;

      opts = opts || {};
      const later = () => {
        previous = opts.leading === false ? 0 : Date.now();
        timeout = null;
        result = fn.apply(context, args);
        if (!timeout) context = args = null;
      };

      return function() {
        var now = Date.now();
        if (!previous && opts.leading === false) previous = now;
        var remaining = wait - (now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0 || remaining > wait) {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          previous = now;
          result = fn.apply(context, args);
          if (!timeout) context = args = null;
        } else if (!timeout && opts.trailing !== false) {
          timeout = setTimeout(later, remaining);
        }
        return result;
      };
    }
    global.throttle = throttle;

    const storageStore = (key, val) => {
      try {
        return localStorage.setItem(key, val);
      } catch (e) {
        console.warn(`Failed to store: ${key}`, e);
        return null;
      }
    }
    global.storageStore = storageStore;

    const storageRetrieve = (key) => {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn(`Failed to retrieve: ${key}`, e);
        return null;
      }
    }
    global.storageRetrieve = storageRetrieve;

    const storageRemove = (key) => {
      try {
        return localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove: ${key}`, e);
        return null;
      }
    }
    global.storageRemove = storageRemove;

    const secondsToHMS = (totalSecs) => {
      if (Number.isNaN(totalSecs)) return { hours: 0, mins: 0, secs: 0 };

      const hours = Math.floor(totalSecs / 3600);
      totalSecs   = totalSecs % 3600;
      const mins  = Math.floor(totalSecs / 60);
      const secs  = Math.floor(totalSecs % 60);

      return {hours, mins, secs}
    }
    global.secondsToHMS = secondsToHMS;

    const secondsToString = (s) => {
      const t = secondsToHMS(s);
      return `${pad(t.hours)}:${pad(t.mins)}:${pad(t.secs)}`;
    }
    global.secondsToString = secondsToString;

    const pad = (s) => {
      s = s.toString();
      if (s.length < 2) return `0${s}`;

      return s;
    }
    global.pad = pad;

    const addCommas = (n) => {
      const parts = n.toString().split('.');
      const s = parts[0];
      const decimal = parts[1];
      const arr = [...s].reverse(); // ['1', '2', '3', '4', '5', '6', '7'];
      const formatted = []; // []
      arr.forEach((c, i) => {
        const mod = i % 3;
        if (i > 0 && mod === 0) {
          formatted.push(',', c);
        } else {
          formatted.push(c);
        }
      });

      if (decimal) {
        const output = `${formatted.reverse().join('')}.${decimal}`;
        return output;
      } else {
        const output = `${formatted.reverse().join('')}`;
        return output;
      }
    };
    global.addCommas = addCommas;

    const limitPrecision = (v, places) => {
      const factor = Math.pow(10, places);
      return Math.round(v * factor) / factor;
    }
    global.limitPrecision = limitPrecision;

    const minmax = (min, val, max) => Math.max(min, Math.min(max, val));
    global.minmax = minmax;

    // UTF Base64 encode/decode
    const base64EncodeUTF = (str) => {
      return btoa(
        encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1))
      );
    }
    global.base64EncodeUTF = base64EncodeUTF;

    const base64DecodeUTF = (str) => {
      return decodeURIComponent(
        atob(str).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
      );
    }
    global.base64DecodeUTF = base64DecodeUTF;

    /* Type checking */
    const is = (type) => (v) => typeof v === type;
    const isNumber = is('number');
    const isString = is('string');
    const isBoolean = is('boolean');
    const isUndefined = is('undefined');
    global.isNumber = isNumber;
    global.isUndefined = isUndefined;
    global.isString = isString;

    /* CSS Variables */
    const setCSSVariableString = (k, v, target) => {
      const el = target || document.documentElement;
      el.style.setProperty(k, `'${v}'`);
    };
    const setCSSVariableNumber = (k, v, target) => {
      const el = target || document.documentElement;
      el.style.setProperty(k, v);
    };
    const clearCSSVariable = (k, target) => setCSSVariableNumber(k, null, target);
    global.setCSSVariableString = setCSSVariableString;
    global.setCSSVariableNumber = setCSSVariableNumber;
    global.clearCSSVariable = clearCSSVariable;

    const getCSSVariable = (v, optTarget) => {
      const target = (!optTarget ? document.documentElement : optTarget);
      const val = getComputedStyle(target).getPropertyValue(v);

      return (val == +val ? +val : val); // Convert to number type if it is a numeric string
    }
    global.getCSSVariable = getCSSVariable;
  
