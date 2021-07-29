# OSM GeoJSON Tiles

Daily updating extracts from OpenStreetMap of the following types:

* bins (amenity:waste_basket, amenity:recycling, amenity:waste_disposal) - The [tiles/bins/](tiles/bins/) subdirectory powers the [ODI Leeds OpenStreetMap Bin explorer](https://odileeds.github.io/osmedit/bins/).
* trees

 We provide static GeoJSON files arranged in the following structure:

  * Tiles: `https://odileeds.github.io/osm-geojson/tiles/{type}/{z}/{x}/{y}.geojson` [ODbL licence](LICENSE.md)
  * Areas: `https://odileeds.github.io/osm-geojson/areas/{type}/GB/{LAD20CD}.geojson` [ODbL licence](LICENSE.md)
  * Area boundaries: `https://odileeds.github.io/osm-geojson/boundaries/GB/{LAD20CD}.geojson` [OGLv3 licence](boundaries/GB/LICENSE.md)

where `{LAD20CD}` is the ONS Local Authority District code as of May 2020, `{type}` is the type of feature (e.g. `bins` or `trees`), `{z}` is the zoom level (only 12), and `{x}` & `{y}` are the [tile coordinates](https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames).

The data in this repo are created by code in our [OSM GeoJSON Tile Maker repo](https://github.com/odileeds/osm-geojson-tile-maker).

## Statistics

You can see area breakdowns by type:

  * [Bin statistics by UK local authority](https://odileeds.github.io/osm-geojson/areas/bins/stats)
  * [Tree statistics by UK local authority](https://odileeds.github.io/osm-geojson/areas/trees/stats)
