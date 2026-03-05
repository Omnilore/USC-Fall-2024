# Squarespace Membership Form Pre-fill Setup

Add this script to your **Membership** page in Squarespace so the "Membership 2 Info" form fills from URL parameters when users come from the Omnilore app.

## Where to add it in Squarespace

1. **Open your site**  
   Go to [omnilore-ecart.squarespace.com](https://omnilore-ecart.squarespace.com) and log in.

2. **Go to Pages**  
   In the left sidebar, click **Pages** (you may already be there).

3. **Open the Membership page settings**  
   - Click the **Membership** page (under Main Navigation).  
   - Click the **gear icon** (⚙️) or **Settings** for that page.  
   - If you see tabs (General, SEO, Advanced, etc.), open **Advanced**.

4. **Paste the script in Code Injection**  
   - Find **Page Header Code Injection** or **Code Injection** (for this page only).  
   - Paste the **entire script** from the section below into the **Header** box.  
   - Save the page.

5. **Publish**  
   Make sure the Membership page is published so the script runs on the live page.

## Script to paste

**Replace** whatever you had in Header Code Injection with this **entire** script. It finds fields by container text (works with Squarespace’s structure) and runs when the main page or modal/iframe loads.

Copy everything below (from `<script>` to `</script>`) and paste it into the **Page Header Code Injection** box for the Membership page:

```html
<script>
(function() {
  try {
  function getParams() {
    try {
      var url = (window.top && window.top.location) ? window.top.location.search : window.location.search;
      return new URLSearchParams(url);
    } catch (e) {
      return new URLSearchParams(window.location.search);
    }
  }
  var params = getParams();
  if (!params.toString()) return;

  var map = {
    'First Name': ['firstName', 'firstname', 'SQF_FIRSTNAME', 'SQF_FIRST_NAME'],
    'Last Name': ['lastName', 'lastname', 'SQF_LASTNAME', 'SQF_LAST_NAME'],
    'Street Address': ['address', 'street_address', 'streetAddress', 'SQF_STREET_ADDRESS', 'SQF_ADDRESS'],
    'City': ['city', 'SQF_CITY'],
    'State': ['state', 'SQF_STATE'],
    'Zip Code': ['zip', 'zipCode', 'zip_code', 'SQF_ZIP_CODE', 'SQF_ZIP'],
    'Email': ['email', 'SQF_EMAIL'],
    'Phone': ['phone', 'SQF_PHONE']
  };

  var nameToKey = {
    'firstname': 'First Name', 'first_name': 'First Name', 'firstName': 'First Name',
    'lastname': 'Last Name', 'last_name': 'Last Name', 'lastName': 'Last Name',
    'address': 'Street Address', 'street_address': 'Street Address', 'streetaddress': 'Street Address',
    'city': 'City', 'state': 'State', 'zip': 'Zip Code', 'zipcode': 'Zip Code', 'zip_code': 'Zip Code',
    'email': 'Email', 'phone': 'Phone'
  };

  function getParam(keys) {
    for (var i = 0; i < keys.length; i++) {
      var v = params.get(keys[i]);
      if (v) return decodeURIComponent(v);
    }
    return '';
  }

  function formatZip(s) {
    if (!s || typeof s !== 'string') return s;
    s = String(s).replace(/^-+/, '').trim();
    var digits = s.replace(/\D/g, '');
    var out = digits.length === 9 ? digits.slice(0, 5) + '-' + digits.slice(5) : (digits.length === 5 ? digits : s);
    return out.replace(/^-+/, '');
  }
  function zipDigitsOnly() {
    var s = getParam(map['Zip Code']);
    if (!s) return '';
    return String(s).replace(/\D/g, '');
  }

  function getModalForm(doc) {
    var modal = doc.querySelector('.sqs-modal-lightbox-content') || doc.querySelector('.lightbox-inner');
    if (!modal) return null;
    try {
      var style = doc.defaultView && doc.defaultView.getComputedStyle ? doc.defaultView.getComputedStyle(modal) : null;
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return null;
      if (modal.offsetParent === null && modal.offsetHeight === 0) return null;
    } catch (e) {}
    var form = modal.querySelector('form');
    return form || null;
  }

  function setInput(input, value, onlyIfEmpty, silent) {
    if (!value || !input) return;
    if (onlyIfEmpty && String((input.value || '')).trim() !== '') return;
    var tag = (input.tagName || '').toUpperCase();
    var type = (input.type || '').toLowerCase();
    if (tag !== 'SELECT' && tag !== 'TEXTAREA' && type !== 'text' && type !== 'tel' && type !== 'email' && type !== 'number') return;
    try {
      if (tag === 'SELECT') {
        input.value = value;
        if (!silent) {
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } else {
        var proto = tag === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        var setter = Object.getOwnPropertyDescriptor(proto, 'value');
        if (setter && setter.set) {
          setter.set.call(input, value);
        } else {
          input.setAttribute('value', value);
          input.value = value;
        }
        if (!silent) {
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          if (!onlyIfEmpty) input.dispatchEvent(new Event('blur', { bubbles: true }));
        }
      }
    } catch (e) {}
  }

  function labelMatches(labelText, key) {
    if (!labelText) return false;
    var lt = labelText.toLowerCase();
    var k = key.toLowerCase();
    return lt.indexOf(k) !== -1;
  }

  function isFieldWeDoNotHave(labelText) {
    if (!labelText) return false;
    var lt = labelText.toLowerCase();
    return lt.indexOf('birth year') !== -1 || lt.indexOf('emergency contact') !== -1 || lt.indexOf('emergency') !== -1;
  }

  function isFieldSizedContainer(node) {
    if (!node || !node.textContent) return false;
    var len = node.textContent.length;
    var cls = (node.className || '') + ' ';
    return len < 120 || cls.indexOf('form-item') !== -1 || cls.indexOf('field') !== -1;
  }

  function getLabelForInput(doc, input) {
    var aria = input.getAttribute && input.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    var id = input.id;
    if (id) {
      var labels = doc.querySelectorAll('label[for]');
      for (var j = 0; j < labels.length; j++) {
        if (labels[j].getAttribute('for') === id && labels[j].textContent) {
          return labels[j].textContent.trim();
        }
      }
    }
    var prev = input.previousElementSibling;
    if (prev && (prev.tagName === 'LABEL' || prev.querySelector && prev.querySelector('label'))) {
      var t = prev.tagName === 'LABEL' ? prev.textContent : (prev.querySelector('label') && prev.querySelector('label').textContent);
      if (t) return t.trim();
    }
    var parent = input.parentElement;
    for (var i = 0; i < 5 && parent; i++) {
      var label = parent.querySelector('label');
      if (label && label.textContent) return label.textContent.trim();
      var first = parent.firstElementChild || parent.firstChild;
      if (first && first.textContent && first.nodeType === 1 && first !== input && (first.tagName === 'LABEL' || first.tagName === 'SPAN')) {
        if (first.textContent.trim().length < 80) return first.textContent.trim();
      }
      if (parent.textContent && parent.textContent.length < 200) return parent.textContent.trim();
      parent = parent.parentElement;
    }
    return '';
  }

  function fieldIsExcluded(nameOrLabel) {
    if (!nameOrLabel) return false;
    var s = nameOrLabel.toLowerCase();
    return s.indexOf('birth') !== -1 || s.indexOf('emergency') !== -1;
  }

  function fillByInputName(doc, form, onlyIfEmpty) {
    if (!form) return;
    var inputs = form.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var labelText = getLabelForInput(doc, input);
      if (isFieldWeDoNotHave(labelText)) continue;
      var name = (input.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
      var id = (input.id || '').toLowerCase();
      var placeholder = (input.placeholder || '').toLowerCase();
      var combined = name + ' ' + id + ' ' + placeholder;
      if (fieldIsExcluded(combined)) continue;
      for (var nm in nameToKey) {
        if (name === nm || id.indexOf(nm.replace(/_/g, '')) !== -1 || placeholder.indexOf(nm.replace(/_/g, ' ')) !== -1) {
          var key = nameToKey[nm];
          var val = key === 'Zip Code' ? zipDigitsOnly() : getParam(map[key]);
          setInput(input, val, onlyIfEmpty, !!onlyIfEmpty);
          break;
        }
      }
    }
  }

  function fillByOrder(doc, onlyIfEmpty) {
    var form = getModalForm(doc);
    if (!form) return;
    var ordered = [];
    var containers = form.querySelectorAll('.form-item');
    for (var i = 0; i < containers.length; i++) {
      var inp = containers[i].querySelector('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea');
      if (!inp) continue;
      var labelEl = containers[i].querySelector('label');
      var labelText = (labelEl && labelEl.textContent ? labelEl.textContent : '') || (containers[i].textContent || '').trim();
      if (labelText.length > 0 && (labelText.toLowerCase().indexOf('birth') !== -1 || labelText.toLowerCase().indexOf('emergency') !== -1)) continue;
      ordered.push(inp);
    }
    if (ordered.length < 8) {
      ordered = [];
      var allFields = form.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea');
      for (var i = 0; i < allFields.length; i++) {
        var el = allFields[i];
        var parent = el.closest ? el.closest('.form-item') : el.parentElement;
        while (parent && parent !== form && !(parent.className && parent.className.indexOf('form-item') !== -1)) parent = parent.parentElement;
        if (parent) {
          var labelText = (parent.textContent || '').trim();
          if (labelText.length > 0 && (labelText.toLowerCase().indexOf('birth') !== -1 || labelText.toLowerCase().indexOf('emergency') !== -1)) continue;
        }
        ordered.push(el);
      }
    }
    var values = [
      getParam(map['First Name']),
      getParam(map['Last Name']),
      getParam(map['Street Address']),
      getParam(map['City']),
      getParam(map['State']),
      zipDigitsOnly(),
      getParam(map['Phone']),
      getParam(map['Email'])
    ];
    for (var j = 0; j < 8 && j < ordered.length; j++) {
      if (!values[j]) continue;
      var inp = ordered[j];
      var v = values[j];
      if (j === 5) v = zipDigitsOnly();
      var forceZip = (j === 5 && String((inp.value || '').trim()).startsWith('-'));
      setInput(inp, v, forceZip ? false : onlyIfEmpty, !!onlyIfEmpty);
    }
  }

  function fillInDoc(doc, onlyIfEmpty) {
    if (!doc || !doc.querySelectorAll) return;
    var form = getModalForm(doc);
    if (!form) return;
    var keysByLength = Object.keys(map).sort(function(a, b) { return b.length - a.length; });
    onlyIfEmpty = !!onlyIfEmpty;

    fillByOrder(doc, onlyIfEmpty);
    fillByInputName(doc, form, onlyIfEmpty);

    var inputs = form.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var labelText = getLabelForInput(doc, input);
      if (!labelText || isFieldWeDoNotHave(labelText)) continue;
      for (var k = 0; k < keysByLength.length; k++) {
        var key = keysByLength[k];
        if (labelMatches(labelText, key)) {
          if (key === 'Phone' && labelText.toLowerCase().indexOf('emergency') !== -1) break;
          var val = key === 'Zip Code' ? zipDigitsOnly() : getParam(map[key]);
          var forceZip = key === 'Zip Code' && String((input.value || '').trim()).startsWith('-');
          setInput(input, val, forceZip ? false : onlyIfEmpty, !!onlyIfEmpty);
          break;
        }
      }
    }

    var formItems = form.querySelectorAll('.form-item, .field-list > div, .field-list .field, [class*="form-item"]');
    for (var i = 0; i < formItems.length; i++) {
      var item = formItems[i];
      var labelEl = item.querySelector('label');
      var labelText = (labelEl && labelEl.textContent) ? labelEl.textContent.trim() : (item.textContent || '').trim();
      if (isFieldWeDoNotHave(labelText)) continue;
      var input = item.querySelector('input:not([type=hidden]):not([type=submit]):not([type=button]), select');
      if (!input) continue;
      for (var k = 0; k < keysByLength.length; k++) {
        var key = keysByLength[k];
        if (labelMatches(labelText, key)) {
          if (key === 'Phone' && labelText.toLowerCase().indexOf('emergency') !== -1) break;
          var val = key === 'Zip Code' ? zipDigitsOnly() : getParam(map[key]);
          var forceZip = key === 'Zip Code' && String((input.value || '').trim()).startsWith('-');
          setInput(input, val, forceZip ? false : onlyIfEmpty, !!onlyIfEmpty);
          break;
        }
      }
    }

    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      var node = el.parentElement;
      for (var d = 0; node && d < 8; d++) {
        if (!isFieldSizedContainer(node)) { node = node.parentElement; continue; }
        var labelText = (node.textContent || '').trim();
        if (isFieldWeDoNotHave(labelText)) { node = node.parentElement; continue; }
        for (var k = 0; k < keysByLength.length; k++) {
          var key = keysByLength[k];
          if (labelMatches(labelText, key)) {
            if (key === 'Phone' && labelText.toLowerCase().indexOf('emergency') !== -1) break;
            var val = key === 'Zip Code' ? zipDigitsOnly() : getParam(map[key]);
            var forceZip = key === 'Zip Code' && String((el.value || '').trim()).startsWith('-');
            if (val) setInput(el, val, forceZip ? false : onlyIfEmpty, !!onlyIfEmpty);
            break;
          }
        }
        node = node.parentElement;
      }
    }
  }

  function forceFirstFourByIndex(doc, onlyIfEmpty) {
    var form = getModalForm(doc);
    if (!form) return;
    var containers = form.querySelectorAll('.form-item');
    var vals = [getParam(map['First Name']), getParam(map['Last Name']), getParam(map['Street Address']), getParam(map['City'])];
    for (var i = 0; i < 4 && i < containers.length; i++) {
      var field = containers[i].querySelector('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea');
      if (field && vals[i]) setInput(field, vals[i], onlyIfEmpty, !!onlyIfEmpty);
    }
  }

  function fixZipLeadingDash(doc) {
    try {
      var form = getModalForm(doc);
      if (!form) return;
      var zipVal = zipDigitsOnly();
      if (!zipVal) return;
      var items = form.querySelectorAll('.form-item, [class*="form-item"]');
      for (var i = 0; i < items.length; i++) {
        var labelEl = items[i].querySelector('label');
        var labelText = (labelEl && labelEl.textContent) ? labelEl.textContent.trim() : (items[i].textContent || '').trim();
        if (labelText.toLowerCase().indexOf('zip') === -1) continue;
        var inp = items[i].querySelector('input');
        if (!inp) continue;
        var cur = String((inp.value || '').trim()).replace(/^-+/, '');
        if (cur.length > 0 && cur.replace(/\D/g, '') === zipVal) continue;
        setInput(inp, zipVal, false, false);
      }
    } catch (e) {}
  }

  var modalScrolledToTop = false;
  function scrollModalToTopOnce(doc) {
    try {
      var modal = doc.querySelector('.sqs-modal-lightbox-content') || doc.querySelector('.lightbox-inner');
      if (!modal) return;
      var all = modal.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (el.scrollTop !== undefined && el.scrollHeight > el.clientHeight) {
          el.scrollTop = 0;
        }
        var style = doc.defaultView && doc.defaultView.getComputedStyle ? doc.defaultView.getComputedStyle(el) : null;
        if (style && (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll')) {
          el.scrollTop = 0;
        }
      }
      for (var el = modal; el && el !== doc.body; el = el.parentElement) {
        if (el.scrollTop !== undefined && el.scrollHeight > el.clientHeight) {
          el.scrollTop = 0;
        }
      }
      if (modal.scrollTop !== undefined) modal.scrollTop = 0;
    } catch (e) {}
  }

  var restoreIntervalId = null;
  var modalWasOpen = false;
  setInterval(function() {
    var modalOpen = !!getModalForm(document);
    if (modalWasOpen && !modalOpen) modalScrolledToTop = false;
    modalWasOpen = modalOpen;
  }, 400);
  function anyAddToCartLoading(doc) {
    if (!doc || !doc.querySelector) return false;
    return !!doc.querySelector('.sqs-add-to-cart-button.cart-adding, .cart-adding, [class*="loading"].sqs-add-to-cart-button');
  }
  function run() {
    var modalOpen = !!getModalForm(document);
    if (!modalOpen) {
      modalScrolledToTop = false;
      fillInDoc(document);
      forceFirstFourByIndex(document);
    } else if (modalScrolledToTop) {
      var form = getModalForm(document);
      var firstInput = form && form.querySelector('input:not([type=hidden]):not([type=submit]):not([type=button])');
      var formLooksEmpty = firstInput && !String((firstInput.value || '')).trim();
      if (formLooksEmpty) modalScrolledToTop = false;
      else {
        fillInDoc(document, true);
        forceFirstFourByIndex(document, true);
        fixZipLeadingDash(document);
        return;
      }
    }
    if (modalOpen && !modalScrolledToTop) {
      modalScrolledToTop = true;
      fillInDoc(document);
      forceFirstFourByIndex(document);
      function doScroll() { scrollModalToTopOnce(document); }
      if (document.requestAnimationFrame) document.requestAnimationFrame(doScroll);
      else doScroll();
      setTimeout(doScroll, 50);
      setTimeout(doScroll, 150);
      setTimeout(doScroll, 400);
      setTimeout(function() { fixZipLeadingDash(document); }, 400);
      setTimeout(function() { fixZipLeadingDash(document); }, 1000);
      if (restoreIntervalId) clearInterval(restoreIntervalId);
      restoreIntervalId = setInterval(function() {
        if (!getModalForm(document)) { clearInterval(restoreIntervalId); restoreIntervalId = null; return; }
        if (anyAddToCartLoading(document)) { clearInterval(restoreIntervalId); restoreIntervalId = null; return; }
        fillInDoc(document, true);
        forceFirstFourByIndex(document, true);
        fixZipLeadingDash(document);
      }, 1500);
    }
    try {
      var iframes = document.querySelectorAll('iframe');
      for (var j = 0; j < iframes.length; j++) {
        try {
          if (iframes[j].contentDocument && iframes[j].contentDocument.body) {
            fillInDoc(iframes[j].contentDocument);
            forceFirstFourByIndex(iframes[j].contentDocument);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  function schedule() {
    run();
    setTimeout(run, 150);
    setTimeout(run, 500);
    setTimeout(run, 1200);
    setTimeout(run, 2500);
    setTimeout(run, 4500);
    setTimeout(run, 6500);
    setTimeout(run, 8500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule);
  } else {
    schedule();
  }
  var observer = new MutationObserver(function() {
    run();
    setTimeout(run, 50);
    setTimeout(run, 200);
    setTimeout(run, 600);
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  document.querySelectorAll('iframe').forEach(function(iframe) {
    iframe.addEventListener('load', run);
  });
  document.addEventListener('click', function stopRestoreOnAddToCart(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest('.sqs-add-to-cart-button') || (t.closest('.sqs-modal-lightbox-content, .lightbox-inner') && (t.closest('button[type="submit"]') || (t.tagName === 'BUTTON' && /add|cart|submit/i.test((t.textContent || '').trim()))))) {
      if (restoreIntervalId) { clearInterval(restoreIntervalId); restoreIntervalId = null; }
    }
  }, true);
  for (var t = 0; t < 30; t++) {
    (function(tt) { setTimeout(function() { run(); }, 200 + tt * 400); })(t);
  }
  } catch (e) {}
})();
</script>
```

## What this does

- Reads `firstName`, `lastName`, `email`, `phone`, `address`, `city`, `state`, `zip` (and `SQF_` variants) from the URL.
- Fills **only** these fields (data from your app): First Name, Last Name, Street Address, City, State, Zip Code, Email, Phone. Label matching is **case-insensitive** (e.g. "First name (required)" matches).
- **Leaves blank** any field the database does not provide, including: Birth Year, Emergency Contact Name, Emergency Contact Phone. Checkbox/radio fields (Privacy, Terms, Gender, etc.) are left for the user to fill.
- Runs on page load and when the "Membership 2 Info" modal appears, so the form is filled at the right time.

## If your form labels are different

If your Squarespace form uses different label text (e.g. "First name" instead of "First Name"), change the **keys** in the `map` object to match exactly. The **values** (param names) can stay as they are.

## Testing

1. In the Omnilore app, click **Join or renew membership**, search for a member, select them, and click **Continue with selected member**.  
2. Squarespace should open in a new tab with query parameters in the URL.  
3. Add a membership to cart and open the "Membership 2 Info" form.  
4. The form fields should be pre-filled with that member’s information.
