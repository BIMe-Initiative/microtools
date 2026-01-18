# AMX Content Separation and WordPress Deployment

This document explains how the Adaptive Maturity Matrix content is shared from GitHub and used by both the AMX app and WordPress.

## 1) Shared content source (GitHub)

- Source file: `data/amx-content.json`
- Raw URL (example):
  `https://raw.githubusercontent.com/BIMe-Initiative/microtools/main/adaptive-maturity-matrix/data/amx-content.json`
- Update cadence: edit JSON in GitHub when needed (every few months).

Notes:
- JSON supports line breaks using `\n`.
- Keep content plain text for safety. The renderers apply their own formatting.

## 1b) Shared action statements (GitHub)

- Source file: `data/amx-actions.json`
- Raw URL (example):
  `https://raw.githubusercontent.com/BIMe-Initiative/microtools/main/adaptive-maturity-matrix/data/amx-actions.json`
- Derived from: BIM ThinkSpace Episode 28 action statements table.

## 2) AMX app usage

The app now loads content from the JSON file at runtime:
- Default path: `data/amx-content.json`
- Optional override: append `?data=<url>` to the app URL to load a different JSON source.

The Plan tab loads action statements from:
- Default path: `data/amx-actions.json`
- Optional override: append `?actions=<url>` to the app URL.

Example:
`https://bime-initiative.github.io/microtools/amx/index.html?data=https://raw.githubusercontent.com/BIMe-Initiative/microtools/main/adaptive-maturity-matrix/data/amx-content.json&actions=https://raw.githubusercontent.com/BIMe-Initiative/microtools/main/adaptive-maturity-matrix/data/amx-actions.json`

### Local fonts

The widget uses locally hosted Raleway fonts stored in `assets/fonts/`. If you move the widget, ensure the font files remain at the same relative path.

### Responsive iframe (auto-height)

Use this in a WordPress Custom HTML block to auto-resize the iframe:

```html
<iframe
  id="amx-iframe"
  src="https://bime-initiative.github.io/microtools/adaptive-maturity-matrix/"
  width="100%"
  height="800"
  style="border:0"
  title="Adaptive Maturity Matrix"
  loading="lazy">
</iframe>
<script>
  window.addEventListener("message", function (e) {
    if (!e.data || e.data.type !== "amx-height") return;
    var iframe = document.getElementById("amx-iframe");
    if (!iframe) return;
    iframe.style.height = Math.max(600, Math.ceil(e.data.height)) + "px";
  });
</script>
```

## 3) WordPress native table (shortcode)

Add the following shortcode to a child theme `functions.php` or a small custom plugin. It fetches the JSON, caches it (transient), and renders a native HTML table.

```php
function amx_fetch_matrix_data($url) {
  $cache_key = 'amx_matrix_json';
  $cached = get_transient($cache_key);
  if ($cached) {
    return $cached;
  }

  $response = wp_remote_get($url, array('timeout' => 10));
  if (is_wp_error($response)) {
    return null;
  }

  $body = wp_remote_retrieve_body($response);
  $data = json_decode($body, true);
  if (!is_array($data)) {
    return null;
  }

  set_transient($cache_key, $data, 12 * HOUR_IN_SECONDS);
  return $data;
}

function amx_render_matrix_table($atts) {
  $atts = shortcode_atts(array(
    'src' => 'https://raw.githubusercontent.com/BIMe-Initiative/microtools/main/adaptive-maturity-matrix/data/amx-content.json'
  ), $atts);

  $data = amx_fetch_matrix_data($atts['src']);
  if (!$data) {
    return '<p>Matrix data is unavailable.</p>';
  }

  $rows = $data['rows'];
  $cols = $data['cols'];
  $cells = $data['cells'];

  $grid = array();
  foreach ($cells as $cell) {
    if (!isset($grid[$cell['row']])) {
      $grid[$cell['row']] = array();
    }
    $grid[$cell['row']][$cell['col']] = $cell;
  }

  ob_start();
  ?>
  <div class="amx-table-wrap" data-amx-table data-amx-json-url="<?php echo esc_url($atts['src']); ?>">
    <table class="amx-table">
    <thead>
      <tr>
        <th>ACI \ PMI</th>
        <?php foreach ($cols as $col) : ?>
          <th><?php echo esc_html($col['table_label']); ?></th>
        <?php endforeach; ?>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($rows as $row) : ?>
        <tr>
          <th><?php echo esc_html($row['table_label']); ?></th>
          <?php foreach ($cols as $col) : ?>
            <?php
              $cell = isset($grid[$row['id']][$col['id']]) ? $grid[$row['id']][$col['id']] : null;
              $text = $cell ? $cell['current'] : '';
              $lead = $cell && isset($cell['lead']) ? $cell['lead'] : '';
            ?>
            <td>
              <?php if ($lead) : ?>
                <strong><?php echo esc_html($lead); ?></strong><br>
              <?php endif; ?>
              <?php echo nl2br(esc_html($text)); ?>
            </td>
          <?php endforeach; ?>
        </tr>
      <?php endforeach; ?>
    </tbody>
    </table>
    <div class="amx-table-tools">
      <button type="button" class="amx-btn" data-amx-copy>Copy HTML</button>
      <button type="button" class="amx-btn" data-amx-download>Download JSON</button>
    </div>
    <script>
      (function(){
        var root = document.currentScript && document.currentScript.closest('[data-amx-table]');
        if (!root) return;
        function setLabel(btn, label) {
          btn.textContent = label;
          setTimeout(function(){ btn.textContent = btn.dataset.label; }, 1400);
        }
        var copyBtn = root.querySelector('[data-amx-copy]');
        var dlBtn = root.querySelector('[data-amx-download]');
        if (copyBtn) {
          copyBtn.dataset.label = copyBtn.textContent;
          copyBtn.addEventListener('click', function(){
            var table = root.querySelector('.amx-table');
            if (!table) return;
            var html = table.outerHTML;
            var doCopy = (navigator.clipboard && navigator.clipboard.writeText)
              ? navigator.clipboard.writeText(html)
              : Promise.reject();
            doCopy.then(function(){ setLabel(copyBtn, 'copied'); })
              .catch(function(){
                var ta = document.createElement('textarea');
                ta.value = html;
                document.body.appendChild(ta);
                ta.select();
                try {
                  document.execCommand('copy');
                  setLabel(copyBtn, 'copied');
                } catch (e) {}
                document.body.removeChild(ta);
              });
          });
        }
        if (dlBtn) {
          dlBtn.dataset.label = dlBtn.textContent;
          dlBtn.addEventListener('click', function(){
            var url = root.getAttribute('data-amx-json-url');
            if (!url) return;
            fetch(url).then(function(r){ return r.blob(); }).then(function(blob){
              var d = new Date();
              var y = d.getFullYear();
              var m = ('0' + (d.getMonth() + 1)).slice(-2);
              var day = ('0' + d.getDate()).slice(-2);
              var name = 'Adaptive_Maturity_Matrix_Table_' + y + m + day + '.JSON';
              var a = document.createElement('a');
              var href = URL.createObjectURL(blob);
              a.href = href;
              a.download = name;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(href);
              setLabel(dlBtn, 'downloaded');
            }).catch(function(){});
          });
        }
      })();
    </script>
  </div>
  <?php
  return ob_get_clean();
}
add_shortcode('amx_table', 'amx_render_matrix_table');
```

Use in WordPress:
```
[amx_table]
```

## 4) WordPress CSS (match the app look)

Add this to your theme or Cornerstone custom CSS:

```css
$el .amx-table-tools {
  margin-top: 5px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}
$el .amx-btn {
  background: #f37f73;
  color: #fff;
  border: 0;
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 999px;
  text-decoration: none;
  cursor: pointer;
  min-width: 140px;
  text-align: center;
  transition: transform 150ms ease, box-shadow 150ms ease;
}
$el .amx-btn:hover,
$el .amx-btn:focus-visible {
  transform: scale(1.03);
  box-shadow: 0 6px 16px rgba(243, 127, 115, 0.25);
}

.amx-table {
  width: 100%;
  border-collapse: collapse;
  font-family: "Raleway", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
  font-size: 14px;
}
.amx-table th,
.amx-table td {
  border: 1px solid #e5e7eb;
  padding: 10px;
  vertical-align: top;
}
.amx-table thead th {
  background: #f37f73;
  color: #fff;
  font-weight: 700;
}
.amx-table tbody th {
  background: #f8fafc;
  font-weight: 600;
}
```

## 5) Backups

Backup created before content split:
- `backup/index.html.pre-content-split.html`
