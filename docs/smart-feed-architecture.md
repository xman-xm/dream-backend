# Architecture: Smart Algorithmic Feed (5x5)

This document outlines the technical design for the "For You" feed, combining semantic vector similarity with a social-graph "Social Boost" strategy.

## 1. Core Logic: The "Social Boost" (Strategy A)
Instead of hard-coded slots, we use a single mathematical scoring function to rank posts.

### Scoring Formula
$$FinalScore = [(\text{Similarity} \times 0.7) + (\text{Reactions(likes and comments)} \times 0.3)] \times \text{Multiplier}$$

| Variable | Description | Value Range |
| :--- | :--- | :--- |
| **Similarity** | Cosine distance between Post Vector and User Interest Vector. | 0.0 → 1.0 |
| **Reactions(likes and comments)** | Number of likes and comments on the post. | 0 → ∞ |
| **Multiplier** | Social weight boost if the author is a friend. | **1.75x** (Friend) or **1.1x** (Global) |

---

## 2. Recommendation Engine (Database)
The feed is generated using a **Vector Similarity Search** in Neon (Postgres) via `pgvector`.

### Database Changes
- **User Table**: Add `interestEmbedding` (1536 dimensions).
- **Post Table**: Ensure `embedding` is indexed with HNSW for fast retrieval.

### The Algorithm Query
```sql
SELECT p.*, 
  -- 1. Calculate Interest Similarity
  (1 - (p.embedding <=> u.interest_embedding)) as raw_similarity,
  
  -- 2. Check Friendship
  
---

## 3. Dynamic Learning Loop
The system learns the user's "Digital DNA" automatically.

1.  **Implicit Signal**: User likes a post.
2.  **Vector Weighted Average**: 
    - `user.interestEmbedding = (user.interestEmbedding * 0.95) + (post.embedding * 0.05)`
3.  **Drift**: As the user interacts, their interest center moves in the 1536-dimensional space to match their evolving taste.

---

## 4. Mobile Execution: Infinite Scroll (5x5)
To maintain high performance and low data usage, content is fetched in small batches.

### The "Smooth Scroll" Mechanism
- **Batch Size**: 5 posts.
- **Threshold**: `onEndReachedThreshold = 0.5`.
- **Logic**:
  1.  When the user views the 3rd post, the mobile app sends a request for the next 5.
  2.  The next 5 posts are appended to the list in memory.
  3.  **Result**: The user perceives an endless, seamless feed with zero waiting time.

### UI Experience
- **"Home page**: The smart algorithmic feed.

'I have a comment for you,suggest other users at the top of the feed and cotinue suggesting them across the feed'