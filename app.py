from flask import Flask, jsonify , render_template , request
import pandas as pd
from sklearn.cluster import KMeans
import json
import random
import numpy as np
from sklearn.manifold import MDS

bdata = {
    'Manhattan': {
        'great': 50, 'central': 30, 'clean': 40, 'luxurious': 20, 'spacious': 15, 'vibrant': 25, 'convenient': 35, 'views': 10, 'trendy': 18,
        'expensive': 45, 'noisy': 40, 'crowded': 35, 'small': 25, 'overpriced': 20, 'busy': 30, 'no space': 15
    },
    'Brooklyn': {
        'cozy': 45, 'quiet': 35, 'stylish': 20, 'hip': 30, 'spacious': 15, 'affordable': 40, 'artistic': 25, 'residential': 20, 'charming': 10,
        'distant': 5, 'gentrified': 15, 'noisy': 20, 'boring': 12, 'congested': 8
    },
    'Queens': {
        'big': 20, 'quiet': 30, 'affordable': 40, 'diverse': 35, 'clean': 10, 'residential': 25, 'suburban': 15, 'dining': 20,
        'far': 18, 'boring': 12, 'sparse': 8, 'boring': 15, 'no transport': 5
    },
    'Bronx': {
        'spacious': 15, 'affordable': 10, 'cultural': 20, 'family': 30, 'green': 25, 'historical': 10,
        'remote': 12, 'unsafe': 30, 'noisy': 10, 'underdeveloped': 15, 'no dining': 5
    },
    'Staten Island': {
        'quiet': 40, 'clean': 20, 'spacious': 10, 'beautiful': 30, 'suburban': 25, 'views': 15, 'family': 18,
        'isolated': 20, 'inconvenient': 25, 'attractions': 30, 'no transport': 10, 'sleepy': 8
    }
}


app = Flask(__name__)
allData = pd.read_csv('static/data/abnb.csv')
data = allData
data.dropna(inplace=True)
data = data.sample(n=1000, random_state=1) 
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
data['tag'] = data['neighbourhood_group'].apply(lambda b: random.choice(list(bdata[b].keys())) if b in bdata else 'No tag available')
top_10_neighbourhoods = data['neighbourhood'].value_counts().nlargest(10).index.tolist()

def reassign_neighbourhood(neighbourhood):
    if neighbourhood not in top_10_neighbourhoods:
        return np.random.choice(top_10_neighbourhoods)
    return neighbourhood

# Apply the function to reassign neighbourhoods
data['neighbourhood'] = data['neighbourhood'].apply(reassign_neighbourhood)



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

   
@app.route('/api/airbnb_counts')
def airbnb_counts():
    filters = request.args.get('filters')
    mapData = data
    # If filters are provided, apply them
    if filters:
        filters = json.loads(filters)
        # Applying filters to the DataFrame
        for key, value in filters.items():
            mapData = mapData[(mapData[key] >= value[0]) & (mapData[key] <= value[1])]

    # Aggregate data by neighbourhood_group
    result = mapData['neighbourhood_group'].value_counts().reset_index()
    result.columns = ['borough', 'count']
    return jsonify(result.to_dict(orient='records'))

@app.route('/api/mds_variables')
def mds_variables():
    mdsdata = data
    numerical_data = mdsdata.select_dtypes(include=[np.number])
    
    # Compute the correlation matrix and transform it to a distance matrix
    correlation_matrix = numerical_data.corr().abs()
    distance_matrix = 1 - correlation_matrix
    
    # Perform MDS
    mds = MDS(n_components=2, dissimilarity='precomputed', random_state=0)
    mds_coordinates = mds.fit_transform(distance_matrix)
    
    # Prepare data for nodes including attribute names
    attribute_names = numerical_data.columns.tolist()  
    nodes = [{"id": str(i), "name": attribute_names[i], "size": 10} 
             for i in range(len(mds_coordinates))]
    
    # Generate links between nodes based on distance criteria
    links = []
    for i in range(len(distance_matrix)):
        for j in range(i + 1, len(distance_matrix)):
            links.append({
                "source": str(i),  
                "target": str(j),
                "value": float(distance_matrix.iloc[i, j])
            })

    # Construct the JSON response object
    response = {
        "nodes": nodes,
        "links": links
    }

    return jsonify(response)


if __name__ == '__main__':
    app.run(port=8000,debug=True)
