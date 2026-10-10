"""HTTP-level tests for the magazine endpoints."""

from __future__ import annotations

from datetime import datetime

from httpx import AsyncClient

KE = {"Accept-Country": "KE"}
NG = {"Accept-Country": "NG"}


async def test_list_articles_defaults_to_kenya_and_skips_unpublished(client: AsyncClient) -> None:
    response = await client.get("/api/v1/magazine/articles", headers=KE)

    assert response.status_code == 200
    body = response.json()
    assert body["country_code"] == "KE"
    assert body["total"] == 3
    assert body["offset"] == 0

    slugs = [item["slug"] for item in body["items"]]
    assert "orthodontic-care-in-kenya" in slugs
    assert "does-nhif-cover-dental" in slugs
    assert "caring-for-clear-aligners-video" in slugs
    # A draft and a scheduled story exist in the seed but must never be served.
    assert "implant-pricing-primer" not in slugs


async def test_list_articles_is_newest_first(client: AsyncClient) -> None:
    body = (await client.get("/api/v1/magazine/articles", headers=KE)).json()

    assert [item["slug"] for item in body["items"]] == [
        "orthodontic-care-in-kenya",
        "does-nhif-cover-dental",
        "caring-for-clear-aligners-video",
    ]


async def test_list_articles_returns_summaries_without_body(client: AsyncClient) -> None:
    items = (await client.get("/api/v1/magazine/articles", headers=KE)).json()["items"]
    first = items[0]

    assert first["slug"] == "orthodontic-care-in-kenya"
    assert first["title"] == "Orthodontic Care in Kenya Is Growing Up"
    assert first["standfirst"]
    assert first["author_name"] == "Dr. Wanjiku Kamau"
    assert first["category"] == "patient-care"
    assert first["content_type"] == "article"
    assert first["video_url"] is None
    assert first["is_featured"] is True
    assert first["tags"] == ["aligners", "orthodontics"]
    assert "body" not in first


async def test_list_articles_carries_videos_with_their_youtube_link(
    client: AsyncClient,
) -> None:
    body = (await client.get("/api/v1/magazine/articles", headers=KE)).json()

    video = next(item for item in body["items"] if item["content_type"] == "video")
    assert video["slug"] == "caring-for-clear-aligners-video"
    assert video["content_type"] == "video"
    assert video["video_url"] == "https://www.youtube.com/watch?v=aqz-KE-bpKQ"


async def test_list_articles_filters_by_country(client: AsyncClient) -> None:
    response = await client.get("/api/v1/magazine/articles", headers=NG)

    assert response.status_code == 200
    body = response.json()
    assert body["country_code"] == "NG"
    slugs = [item["slug"] for item in body["items"]]
    assert slugs == ["fluoride-lagos-water"]


async def test_list_articles_filter_by_query_country_param(client: AsyncClient) -> None:
    # ``country`` overrides the header, mirroring the jobs and listing routes.
    response = await client.get("/api/v1/magazine/articles", params={"country": "NG"})

    assert response.status_code == 200
    assert response.json()["country_code"] == "NG"


async def test_list_articles_unknown_country_is_an_empty_page(client: AsyncClient) -> None:
    # The magazine has no capability flag: an unconfigured market is filtered
    # to an empty page, the same way the product catalog behaves.
    response = await client.get("/api/v1/magazine/articles", headers={"Accept-Country": "ZZ"})

    assert response.status_code == 200
    body = response.json()
    assert body["country_code"] == "ZZ"
    assert body["items"] == []
    assert body["total"] == 0


async def test_list_articles_filters_by_category(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/magazine/articles", params={"category": "insurance"}, headers=KE
    )

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["slug"] == "does-nhif-cover-dental"


async def test_list_articles_filters_by_tag(client: AsyncClient) -> None:
    response = await client.get("/api/v1/magazine/articles", params={"tag": "aligners"}, headers=KE)

    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["slug"] == "orthodontic-care-in-kenya"


async def test_list_articles_paginates(client: AsyncClient) -> None:
    first_page = await client.get(
        "/api/v1/magazine/articles", params={"limit": 1, "offset": 0}, headers=KE
    )
    second_page = await client.get(
        "/api/v1/magazine/articles", params={"limit": 1, "offset": 1}, headers=KE
    )

    assert first_page.json()["total"] == 3
    assert [item["slug"] for item in first_page.json()["items"]] == ["orthodontic-care-in-kenya"]
    assert [item["slug"] for item in second_page.json()["items"]] == ["does-nhif-cover-dental"]


async def test_get_article_returns_full_article(client: AsyncClient) -> None:
    response = await client.get("/api/v1/magazine/articles/orthodontic-care-in-kenya", headers=KE)

    assert response.status_code == 200
    article = response.json()
    assert article["slug"] == "orthodontic-care-in-kenya"
    assert article["body"].startswith("## A market in motion")
    assert article["tags"] == ["aligners", "orthodontics"]
    assert article["author_name"] == "Dr. Wanjiku Kamau"

    # The article's own country governs the detail, regardless of the header.
    nigerian_reader = await client.get(
        "/api/v1/magazine/articles/orthodontic-care-in-kenya", headers=NG
    )
    assert nigerian_reader.status_code == 200


async def test_get_article_timestamps_are_iso_datetimes(client: AsyncClient) -> None:
    article = (
        await client.get("/api/v1/magazine/articles/orthodontic-care-in-kenya", headers=KE)
    ).json()

    published_at = datetime.fromisoformat(article["published_at"])
    assert published_at.year == 2026
    updated_at = datetime.fromisoformat(article["updated_at"])
    assert updated_at.year == 2026
    assert "created_at" not in article


async def test_get_article_unpublished_slug_is_404(client: AsyncClient) -> None:
    for slug in ["implant-pricing-primer", "sugar-tax-dental-impact"]:
        response = await client.get(f"/api/v1/magazine/articles/{slug}", headers=KE)
        assert response.status_code == 404
        assert response.json()["code"] == 404


async def test_get_article_unknown_slug_is_404(client: AsyncClient) -> None:
    response = await client.get("/api/v1/magazine/articles/does-not-exist", headers=KE)

    assert response.status_code == 404
    body = response.json()
    assert body["code"] == 404
    assert body["message"]


async def test_categories_lists_published_categories_per_country(client: AsyncClient) -> None:
    ke = (await client.get("/api/v1/magazine/categories", headers=KE)).json()
    ng = (await client.get("/api/v1/magazine/categories", headers=NG)).json()

    assert ke["country_code"] == "KE"
    assert ke["categories"] == ["insurance", "patient-care"]
    assert ng["country_code"] == "NG"
    assert ng["categories"] == ["public-health"]


async def test_categories_unknown_country_is_an_empty_list(client: AsyncClient) -> None:
    response = await client.get("/api/v1/magazine/categories", headers={"Accept-Country": "ZZ"})

    assert response.status_code == 200
    assert response.json()["categories"] == []


async def test_magazine_needs_no_auth(client: AsyncClient) -> None:
    # PRD §2 opens the magazine to everyone: no role gate, no auth, no header.
    unauth = await client.get("/api/v1/magazine/articles")
    assert unauth.status_code == 200
    assert unauth.json()["country_code"] == "KE"
