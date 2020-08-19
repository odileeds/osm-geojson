# OSM GeoJSON Tiles

The [tiles/bins/](tiles/bins/) subdirectory powers the [ODI Leeds OpenStreetMap Bin explorer](https://odileeds.github.io/osmedit/bins/). We provide static GeoJSON files arranged in the following structure:

  * Tiles: `https://odileeds.github.io/osm-geojson/tiles/{type}/{z}/{x}/{y}.geojson` [ODbL licence](LICENSE.md)
  * Areas: `https://odileeds.github.io/osm-geojson/areas/{type}/GB/{LAD20CD}.geojson` [ODbL licence](LICENSE.md)
  * Area boundaries: `https://odileeds.github.io/osm-geojson/boundaries/GB/{LAD20CD}.geojson` [OGLv3 licence](boundaries/GB/LICENSE.md)

where `{LAD20CD}` is the ONS Local Authority District code as of May 2020, `{type}` is the type of feature (e.g. `bins`), `{z}` is the zoom level (only 12), and `{x}` & `{y}` are the [tile coordinates](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames).

The data in this repo are created by code in our [OSM GeoJSON Tile Maker repo](https://github.com/odileeds/osm-geojson-tile-maker).
