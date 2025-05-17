const TMDB_API_KEY = process.env.TMDB_API_KEY || 'baef77dbebea87e3a224ad917d2d5682';
const TMDB_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJiYWVmNzdkYmViZWE4N2UzYTIyNGFkOTE3ZDJkNTY4MiIsIm5iZiI6MTc0NjY0MDcyNS4wMjMsInN1YiI6IjY4MWI5ZjU1ZTU1MWI4OTBlNGRmOTUwOCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.giM7pBG4eQbCUZPgiSdVF-FAmvv5FLPCVfzrSBoN1zY';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

console.log('TMDB-Service wird initialisiert');
console.log(`API-Key: ${TMDB_API_KEY.substring(0, 5)}... (vorhanden)`);
console.log(`Access Token: ${TMDB_ACCESS_TOKEN.substring(0, 5)}... (vorhanden)`);

const fetchTMDB = async (endpoint) => {
  // Füge den API-Key als Query-Parameter an
  const url = endpoint.includes('?')
    ? `${TMDB_BASE_URL}${endpoint}&api_key=${TMDB_API_KEY}`
    : `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}`;
  console.log(`Anfrage an TMDB: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { status_message: errorText };
      }
      
      console.error(`TMDB API-Fehler: ${response.status} ${response.statusText}`, errorData);
      return getFallbackData(endpoint);
    }
    
    const jsonData = await response.json();
    console.log(`TMDB-Antwort erhalten für ${endpoint}: ${jsonData.results ? jsonData.results.length : 0} Ergebnisse`);
    return jsonData;
  } catch (error) {
    console.error('Fehler bei TMDB-Anfrage:', error);
    return getFallbackData(endpoint);
  }
};

// Hilfsfunktion für Fallback-Daten
function getFallbackData(endpoint) {
  console.log(`Verwende Fallback-Daten für ${endpoint}`);
  
  if (endpoint.includes('/trending/movie') || endpoint.includes('/movie/upcoming')) {
    return {
      page: 1,
      results: getDummyMovies(),
      total_pages: 1,
      total_results: 3
    };
  }
  
  if (endpoint.includes('/trending/tv') || endpoint.includes('/tv/on_the_air')) {
    return {
      page: 1,
      results: getDummyShows(),
      total_pages: 1,
      total_results: 3
    };
  }
  
  if (endpoint.includes('/search/movie')) {
    return {
      page: 1,
      results: getDummyMovies(),
      total_pages: 1,
      total_results: 3
    };
  }
  
  if (endpoint.includes('/search/tv')) {
    return {
      page: 1,
      results: getDummyShows(),
      total_pages: 1,
      total_results: 3
    };
  }
  
  return {
    page: 1,
    results: [],
    total_pages: 0,
    total_results: 0
  };
}

// Hilfsfunktion für Dummy-Filme als Fallback
function getDummyMovies() {
  return [
    {
      id: 1,
      title: "Matrix",
      overview: "Ein Hacker erfährt, dass die Welt eine Simulation ist, und schließt sich dem Widerstand an.",
      release_date: "1999-03-31",
      poster_path: null,
      backdrop_path: null,
      vote_average: 8.7
    },
    {
      id: 2,
      title: "Inception",
      overview: "Ein Dieb, der in die Träume anderer eindringen kann, erhält den Auftrag, eine Idee zu pflanzen.",
      release_date: "2010-07-16",
      poster_path: null,
      backdrop_path: null,
      vote_average: 8.2
    },
    {
      id: 3,
      title: "Interstellar",
      overview: "Ein Team von Astronauten reist durch ein Wurmloch, um eine neue Heimat für die Menschheit zu finden.",
      release_date: "2014-11-07",
      poster_path: null,
      backdrop_path: null,
      vote_average: 8.4
    }
  ];
}

// Hilfsfunktion für Dummy-Serien als Fallback
function getDummyShows() {
  return [
    {
      id: 101,
      name: "Breaking Bad",
      overview: "Ein Chemielehrer wird zum Drogenproduzenten, um seiner Familie nach der Diagnose einer tödlichen Krankheit finanziell zu helfen.",
      first_air_date: "2008-01-20",
      poster_path: null,
      backdrop_path: null,
      vote_average: 9.2,
      number_of_seasons: 5,
      status: "Ended",
      status_de: "Abgeschlossen",
      in_production: false
    },
    {
      id: 102,
      name: "Game of Thrones",
      overview: "Mehrere noble Familien kämpfen um die Kontrolle über das mythische Land Westeros.",
      first_air_date: "2011-04-17",
      poster_path: null,
      backdrop_path: null,
      vote_average: 8.3,
      number_of_seasons: 8,
      status: "Ended",
      status_de: "Abgeschlossen",
      in_production: false
    },
    {
      id: 103,
      name: "The Mandalorian",
      overview: "Die Abenteuer eines einsamen Kopfgeldjägers im äußeren Rand der Galaxie, weit weg von der Autorität der Neuen Republik.",
      first_air_date: "2019-11-12",
      poster_path: null,
      backdrop_path: null,
      vote_average: 8.5,
      number_of_seasons: 3,
      status: "Returning Series",
      status_de: "Laufend",
      in_production: true
    }
  ];
}

async function searchContent(query, type = 'movie') {
  const searchResults = await fetchTMDB(`/search/${type}?query=${encodeURIComponent(query)}&language=de-DE`);
  
  // Hole zusätzliche Details für Serien
  if (type === 'tv' && searchResults.results && searchResults.results.length > 0) {
    return await enrichTvShowsData(searchResults);
  }
  
  return searchResults;
}

async function getMovieDetails(id) {
  return fetchTMDB(`/movie/${id}?language=de-DE&append_to_response=credits,videos,watch/providers`);
}

async function getShowDetails(id) {
  return fetchTMDB(`/tv/${id}?language=de-DE&append_to_response=credits,videos,watch/providers`);
}

async function getStreamingProviders(id, type) {
  return fetchTMDB(`/${type}/${id}/watch/providers`);
}

async function getTrending(type = 'movie') {
  const trendingData = await fetchTMDB(`/trending/${type}/week?language=de-DE`);
  
  // Hole zusätzliche Details für Serien
  if (type === 'tv' && trendingData.results && trendingData.results.length > 0) {
    return await enrichTvShowsData(trendingData);
  }
  
  return trendingData;
}

async function getUpcoming(type = 'movie') {
  if (type === 'movie') {
    return fetchTMDB(`/movie/upcoming?language=de-DE`);
  } else {
    // Für Serien gibt es keinen "upcoming"-Endpunkt, stattdessen verwenden wir "on the air"
    const onAirData = await fetchTMDB(`/tv/on_the_air?language=de-DE`);
    
    // Hole zusätzliche Details für Serien
    if (onAirData.results && onAirData.results.length > 0) {
      return await enrichTvShowsData(onAirData);
    }
    
    return onAirData;
  }
}

// Neue Funktion: Anreicherung der Seriendetails mit Staffelanzahl und Status
async function enrichTvShowsData(tvData) {
  console.log('Seriendetails werden angereichert...');
  
  // Begrenzen auf maximal 20 API-Calls, um Rate Limits zu vermeiden
  const results = tvData.results || [];
  const promises = [];
  
  for (let i = 0; i < Math.min(results.length, 20); i++) {
    const show = results[i];
    
    promises.push(
      getShowDetails(show.id)
        .then(details => {
          // Ergänze die Seriendetails mit Staffelanzahl und Status
          show.number_of_seasons = details.number_of_seasons || 0;
          show.status = details.status || 'Unknown';
          show.in_production = details.in_production;
          
          // Deutsche Statusbezeichnungen
          show.status_de = mapStatusToGerman(details.status);
          
          return show;
        })
        .catch(err => {
          console.error(`Fehler beim Abrufen der Details für Serie ${show.id}:`, err);
          return show; // Original zurückgeben, wenn Fehler auftritt
        })
    );
  }
  
  await Promise.all(promises);
  return tvData;
}

// Hilfsfunktion: Übersetzung der englischen Statusbezeichnungen
function mapStatusToGerman(status) {
  const statusMap = {
    'Returning Series': 'Laufend',
    'Ended': 'Abgeschlossen',
    'Canceled': 'Abgesetzt',
    'In Production': 'In Produktion',
    'Planned': 'Geplant',
    'Pilot': 'Pilot'
  };
  
  return statusMap[status] || status;
}

module.exports = {
  searchContent,
  getMovieDetails,
  getShowDetails,
  getStreamingProviders,
  getTrending,
  getUpcoming
}; 