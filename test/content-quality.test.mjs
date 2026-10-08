import test from 'node:test';
import assert from 'node:assert/strict';
import { isSimilarTitle, validatePost, visibleText } from '../api/content-quality.js';

const post = {
  title: 'Make a Contact Form Easier to Complete',
  cardSnippet: 'A practical way to simplify the form on your business website.',
  metaDescription: 'Review form labels, required fields, and the confirmation message.',
  bodyTop: '<h2>Start With the Fields</h2><p>Ask only for information you need to reply.</p>',
  bodyBottom: '<h2>Test on a Phone</h2><p>Submit the form and check the confirmation.</p>'
};

test('allows useful content and technical hyphens in links', () => {
  const linked = { ...post, bodyBottom: '<h2>Test</h2><p><a href="https://example.com/contact-form">Open the form</a>.</p>' };
  assert.deepEqual(validatePost(linked), []);
});

test('rejects dashes in visible prose, including HTML entities', () => {
  assert.match(validatePost({ ...post, title: 'A Better Contact-Form' }).join(' '), /hyphen/);
  assert.match(validatePost({ ...post, bodyTop: '<h2>Start</h2><p>Fast&mdash;simple.</p>' }).join(' '), /hyphen/);
  assert.equal(visibleText('<p>A &mdash; B</p>'), 'A - B');
});

test('rejects unsupported results and similar topics', () => {
  assert.match(validatePost({ ...post, bodyBottom: '<h2>Results</h2><p>Our clients saw a 40% lift.</p>' }).join(' '), /Unverified/);
  assert.equal(isSimilarTitle('Make Contact Forms Easier to Complete', 'Make a Contact Form Easier to Complete'), true);
  assert.match(validatePost(post, ['Make Contact Forms Easier to Complete']).join(' '), /similar/);
});

import { validateSeo } from '../api/content-quality.js';
import { nextKeyword, loadKeywords } from '../api/keywords.js';

const entry = { keyword: 'contractor website', slug: 'contractor-website-what-to-include', cta: '/free-mock-up' };
const allowed = ['/free-mock-up', '/blog-post/redesign-website-without-losing-rankings'];
const long = '<p>' + 'word '.repeat(950) + '</p>';
const seoPost = {
  title: 'What a Contractor Website Needs',
  metaDescription: 'A practical checklist for a contractor website that gets calls.',
  bodyTop: '<h2>What Your Contractor Website Should Show First</h2>' + long,
  bodyBottom: '<h2>Next Steps</h2><p><a href="/blog-post/redesign-website-without-losing-rankings">Redesign safely</a> or <a href="/free-mock-up">get a free mockup</a>.</p>'
};

test('passes a keyword targeted post with allowed links', () => {
  assert.deepEqual(validateSeo(seoPost, entry, allowed), []);
});

test('flags missing keyword, short body, and unknown links', () => {
  const bad = { ...seoPost, title: 'Build a Better Site', bodyTop: '<h2>Intro</h2><p>Short.</p>', bodyBottom: '<p><a href="https://example.com">x</a></p>' };
  const issues = validateSeo(bad, entry, allowed).join(' | ');
  assert.match(issues, /Title must contain/);
  assert.match(issues, /at least 900/);
  assert.match(issues, /not on the allowed list/);
  assert.match(issues, /Must link to \/free-mock-up/);
});

test('blocks first person agency voice', () => {
  assert.match(validatePost({ ...post, bodyTop: '<h2>Start</h2><p>Follow our guide.</p>' }).join(' '), /Unverified/);
});

test('keyword queue skips slugs already in the CMS and every queued link target is allowed', () => {
  const { queue, allowedInternalLinks } = loadKeywords();
  assert.equal(nextKeyword(queue, [queue[0].slug]).slug, queue[1].slug);
  assert.equal(nextKeyword(queue, queue.map(q => q.slug)), null);
  for (const q of queue) assert.ok(allowedInternalLinks.includes(q.cta), q.cta);
  assert.equal(new Set(queue.map(q => q.slug)).size, queue.length);
});
