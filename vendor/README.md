# Local frontend libraries

These pinned assets are served from the project so the static demo can run without a network connection.

| Package | Version | Local path | License | Upstream package |
| --- | --- | --- | --- | --- |
| Bootstrap | 5.3.8 | `bootstrap-5.3.8/` | MIT | [`bootstrap@5.3.8`](https://www.npmjs.com/package/bootstrap/v/5.3.8) |
| Bootstrap Icons | 1.13.2 | `bootstrap-icons-1.13.2/` | MIT | [`bootstrap-icons@1.13.2`](https://www.npmjs.com/package/bootstrap-icons/v/1.13.2) |

Bootstrap supplies the CSS framework and bundled JavaScript utilities. Bootstrap Icons supplies the open-source icon font used by the interface. The font file is distributed with the icon stylesheet and is referenced locally from that stylesheet.

The package source licenses are included in their corresponding upstream npm packages. When updating either dependency, update the directory/version names, stylesheet/script references in `index.html`, and this record together. Keep the icon font alongside `bootstrap-icons.min.css` so its relative URL resolves offline.
