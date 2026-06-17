# 🌸 Anime News Network Encyclopedia Skill

This skill allows Makima to access the **Anime News Network (ANN) Encyclopedia API**, providing detailed metadata for anime and manga.

## 🚀 Capabilities

- **Anime/Manga Lookup**: Fetch detailed info (Synopsis, Genres, Themes, Cast, Staff) for any title.
- **Encyclopedia Reports**: Browse lists of recently added or alphabetical titles.
- **Swarm Integration**: The `AnimeAgent` automatically handles queries related to anime/manga.

## 🛠️ Usage Patterns

### 1. General Queries
> "Tell me about the anime Jinki:Extend"
> "What is the plot of Cowboy Bebop?"

### 2. Lists and Searches
> "Find some mecha anime from ANN"
> "Show me the latest titles added to the encyclopedia"

### 3. Deep Research
> "List the cast and crew for Fullmetal Alchemist"

## 📜 Terms of Service Implementation

This skill strictly adheres to the ANN Encyclopedia API TOS:
- **Attribution**: All responses include "Source: Anime News Network".
- **Linking**: Every title result includes a direct link to its ANN Encyclopedia page.
- **Rate Limiting**: Implementation (via `ANNClient`) enforces a 1.2s delay between requests to remain under the 1 req/sec limit.

## 📂 Implementation Details

- **Client**: `core/ann_client.py`
- **Agent**: `Makima_v4/agents/anime_agent.py`
- **XML Parsing**: Structured extraction of `info` tags (Genres, Themes, Plot) and `cast` roles.
- **Batching**: Supports fetching up to 50 IDs in a single request for efficient research.

---
*Created for the Makima v4 Swarm*
