# OSM GeoJSON Tiles

The [tiles/bins/](tiles/bins/) subdirectory powers the [ODI Leeds OpenStreetMap Bin explorer](https://odileeds.github.io/osmedit/bins/). We provide static GeoJSON files arranged in the following structure:

  * Tiles: `https://odileeds.github.io/osm-geojson/tiles/bins/{z}/{x}/{y}.geojson`
  * Areas: `https://odileeds.github.io/osm-geojson/areas/bins/GB/{LAD20CD}.geojson`;
  * Area boundaries: `https://odileeds.github.io/osm-geojson/areas/bins/GB/definitions/{LAD20CD}.geojson`

where `{LAD20CD}` is the ONS Local Authority District code as of May 2020.
