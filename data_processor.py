import pandas as pd
from sklearn.preprocessing import StandardScaler
import numpy as np
from sklearn.cluster import KMeans
from sklearn.metrics import mean_squared_error, pairwise_distances
from constants import file_path,columns_to_drop
from sklearn.manifold import MDS


def process_data():
    df = pd.read_csv(file_path,encoding='latin-1')

    df = df.drop(columns=columns_to_drop)

    df = df.sample(n=500, axis=0).sample(n=10, axis=1)

# Ignore categorical data by selecting only numerical columns
    df_numeric = df.select_dtypes(include=[np.number])

 # Standardize the data
    scaler = StandardScaler()
    data_scaled = scaler.fit_transform(df_numeric)

    return data_scaled,df_numeric, df 


def calculate_kmeans_mse(data_scaled, max_k=10):
    
    # Drop specified columns with null values
    

    # Calculate K-Means MSE for k from 1 to max_k
    mse_values = []
    for k in range(1, max_k + 1):
        kmeans = KMeans(n_clusters=k, random_state=42)
        clusters = kmeans.fit_predict(data_scaled)
        centroids = kmeans.cluster_centers_
        
        # Calculate MSE as the mean of squared distances to centroids
        mse = mean_squared_error(data_scaled, centroids[clusters])
        mse_values.append(mse)

    return mse_values

def calculate_mds_data(data_scaled, n_components=2):

    dissimilarity_matrix = pairwise_distances(data_scaled, metric='euclidean')
    mds = MDS(n_components=n_components, dissimilarity='precomputed', random_state=42)
    mds_transformed = mds.fit_transform(dissimilarity_matrix)
    scaler = StandardScaler()
    mds_scaled = scaler.fit_transform(mds_transformed)

    return mds_scaled

def calculate_clusters(data_scaled, n_clusters):
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    kmeans.fit(data_scaled)
    return kmeans.labels_

def calculate_mds_correlation(data, n_components=2):
    # Compute the correlation matrix
    correlation_matrix = data.corr()

    # Convert correlation matrix to a dissimilarity matrix
    dissimilarity_matrix = 1 - np.abs(correlation_matrix)

    # Perform MDS
    mds = MDS(n_components=n_components, dissimilarity='precomputed', random_state=42)
    mds_transformed = mds.fit_transform(dissimilarity_matrix)

    scaler = StandardScaler()
    mds_scaled = scaler.fit_transform(mds_transformed)

    return mds_scaled