import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizedPhotos} from '../src/lib/photoViewer';
import type {Message,Gallery} from '../src/lib/types';

test('photo viewer navigates only already authorized photos and deduplicates renewed URLs by media ID',()=>{
 const messages:Message[]=[{id:'m:1',role:'assistant',text:'',source:'web',scene_session_id:'s',turn_no:1,created_at:'2026-11-03T00:00:00.000000Z',media_kind:'photo',media_id:'first',photo_url:'https://media.example.test/first-old'},{id:'m:2',role:'assistant',text:'',source:'web',scene_session_id:'s',turn_no:1,created_at:'2026-11-03T00:00:01.000000Z',media_kind:'photo',media_id:'locked'}];
 const media:Gallery['media']=[{unlocked:true,media_id:'first',media_kind:'photo',photo_url:'https://media.example.test/first-renewed'},{unlocked:false,media_id:'locked',media_kind:'photo',scene_session_id:'s',sku:'server-sku',conditions:{price:null,price_required:1}},{unlocked:true,media_id:'second',media_kind:'photo',photo_url:'https://media.example.test/second',created_at:'2026-11-03T00:00:02.000000Z'}];
 assert.deepEqual(authorizedPhotos(messages,media).map(p=>[p.id,p.url]),[['first','https://media.example.test/first-renewed'],['second','https://media.example.test/second']]);
 assert.equal(authorizedPhotos([],media.filter(m=>!m.unlocked)).length,0);
});
