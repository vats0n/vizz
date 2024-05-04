from flask import Flask, jsonify , render_template , request
import pandas as pd
from sklearn.cluster import KMeans
import geopandas as gpd
from shapely.geometry import Point

app = Flask(__name__)
allData = pd.read_csv('static/data/abnb.csv')
data = allData
data = data.sample(n=1000, random_state=1) 
data.dropna(inplace=True)
columns_to_drop = ["id",
  "host_name",
  "host_id",
  "latitude",
  "longitude",
  "last_review",
  "name",
  "calculated_host_listings_count"]
neighbourhood = ["neighbourhood"]
data = data.drop(columns=columns_to_drop)
data = data[data['minimum_nights'] < 180]

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/api/attributes')
def attributes():
   return jsonify(data.to_dict(orient='records'))

@app.route('/api/pcp')
def pcp():
   kmeans = KMeans(n_clusters= 5)
   cluster_labels = kmeans.fit_predict(data.select_dtypes(include=[float, int]))
   response = {
        'data':  data.drop(columns=neighbourhood).to_dict(orient='records'),
        'cluster_labels': cluster_labels.tolist(),
    }
   return jsonify(response)

   
@app.route('/api/map')
def map():
    
    gdf_points = gpd.GeoDataFrame(
    allData, 
    geometry=gpd.points_from_xy(allData.longitude, allData.latitude),
    crs="EPSG:4326"  # WGS84 Latitude/longitude
)
    nyc_gdf = gpd.read_file('static/data/nyc.geojson')
    print(nyc_gdf.columns)  # Check the column names
    print(nyc_gdf.head())   # Preview the first few rows
    gdf_joined = gpd.sjoin(nyc_gdf, gdf_points, how="inner", op='contains')

    # Group by 'neighbourhood_group' in your dataset and 'name' in geojson
    area_data = gdf_joined.groupby('neighbourhood_group').size().reset_index(name='counts')

    # Merge the count data back to the original GeoDataFrame
    # Assuming 'neighbourhood_group' corresponds to 'name' in the geojson properties
    nyc_gdf = nyc_gdf.merge(area_data, left_on='name', right_on='neighbourhood_group', how='left')

    if 'created_at' in nyc_gdf.columns:
        nyc_gdf['created_at'] = nyc_gdf['created_at'].astype(str)
    if 'updated_at' in nyc_gdf.columns:
        nyc_gdf['updated_at'] = nyc_gdf['updated_at'].astype(str)
    geojson_data = nyc_gdf.to_json()

    return geojson_data
 

if __name__ == '__main__':
    app.run(port=8000,debug=True)
