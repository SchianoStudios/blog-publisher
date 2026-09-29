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
