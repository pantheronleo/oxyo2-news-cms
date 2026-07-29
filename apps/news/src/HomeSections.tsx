import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { Category, Post } from './newsApi'
import { ArticleCard, EmptyCopy, Newsletter, SectionTitle, topicImage } from './viewShared'

export default function HomeSections({ categories, featured, grid }: { categories: Category[]; featured: Post[]; grid: Post[] }) {
  return <><SectionTitle eyebrow="Featured stories" title="Fresh perspective, curated daily" /><div className="feature-grid">{featured.slice(1, 4).map(post => <ArticleCard key={post.id} post={post} featured />)}{!featured.slice(1, 4).length && <EmptyCopy />}</div><section className="topics"><div><span className="kicker">Explore</span><h2>See related topics</h2><p>Follow your favorite beats through category pages curated by the ThePaperLeaf desk.</p></div>{categories.slice(0, 6).map((category, i) => <Link className={`topic t${i}`} style={{ '--topic': category.color, '--topic-image': `url(${topicImage(category.slug, 480)})`, '--topic-image-mobile': `url(${topicImage(category.slug, 320)})` } as React.CSSProperties} key={category.id} to={`/category/${category.slug}`}>{category.name}<ArrowRight /></Link>)}</section><SectionTitle eyebrow="Latest news" title="Stories just published" /><div className="latest-grid">{grid.length ? grid.map(post => <ArticleCard key={post.id} post={post} />) : <EmptyCopy />}</div><Newsletter /></>
}
