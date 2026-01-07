/*
 * ⚠️  WARNING: This file is managed through GitHub deployments.
 *    Repository: https://github.com/bsuccar/bimei-vertex-cx-chatbot
 *    Manual changes to this file are not allowed and will be overwritten.
 *    All modifications must be made through the GitHub repository.
 */

'use strict';

const { Neo4jGraph } = require('@langchain/community/graphs/neo4j_graph');
const { ChatVertexAI } = require('@langchain/google-vertexai');
const { Storage } = require('@google-cloud/storage');

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USERNAME = process.env.NEO4J_USERNAME;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
const NEO4J_DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

// ---- Weights (GCS) --------------------------------------------------------

const WEIGHTS_GCS_URI = process.env.WEIGHTS_GCS_URI || '';
const WEIGHTS_TTL_SECONDS = clampInt(process.env.WEIGHTS_TTL_SECONDS, 5, 86400, 300);

const storage = new Storage();

let _weightsCache = null;
let _weightsCacheErr = null;

function defaultWeights() {
  return {
    version: 'builtin-default',
    defaults: {
      node_weight: 0.40,
      edge_weight: 0.30,
      property_bonus: 0.00,
      hop_decay: 0.85,
      max_hops: 10,
    },
    node_types: {
      Construct: 0.95,
      InformationUse: 0.95,
      ActionStatement: 0.90,
      DictionaryItem: 0.70,
      Content: 0.35,
      Deliverable: 0.30,
      Resource: 0.25,
    },
    edge_types: {
      PART_OF: 0.95,
      IS_COMPOSED_OF: 0.90,
      EXPRESSED_AS: 0.85,
      ABOUT: 0.60,
      MENTIONS: 0.40,
      CONTAINS: 0.35,
      LINKS_TO: 0.20,
      INSTANCE_OF: 0.25,
    },
    property_bonuses: {},
    normalisation: { method: 'minmax_per_response', clip: { min: 0.0, max: 1.0 } },
    display_policy: { min_score_to_show: 0.25, max_paths_to_show: 3 },
  };
}

function parseGcsUri(uri) {
  const m = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri || '');
  if (!m) return null;
  return { bucket: m[1], object: m[2] };
}

async function loadWeightsFromGcs() {
  if (!WEIGHTS_GCS_URI) {
    return {
      weights: defaultWeights(),
      source: 'builtin',
      version: 'builtin-default',
      note: 'WEIGHTS_GCS_URI not set; using built-in defaults.',
    };
  }

  const parsed = parseGcsUri(WEIGHTS_GCS_URI);
  if (!parsed) {
    return {
      weights: defaultWeights(),
      source: 'builtin',
      version: 'builtin-default',
      note: `Invalid WEIGHTS_GCS_URI (${WEIGHTS_GCS_URI}); using built-in defaults.`,
    };
  }

  const file = storage.bucket(parsed.bucket).file(parsed.object);
  const [buf] = await file.download();
  const txt = buf.toString('utf8');
  const json = JSON.parse(txt);

  const base = defaultWeights();
  const weights = {
    ...base,
    ...json,
    defaults: { ...(base.defaults || {}), ...(json.defaults || {}) },
    tiers: { ...(base.tiers || {}), ...(json.tiers || {}) },
    node_types: { ...(base.node_types || {}), ...(json.node_types || {}) },
    edge_types: { ...(base.edge_types || {}), ...(json.edge_types || {}) },
    property_bonuses: {
      ...(base.property_bonuses || {}),
      ...(json.property_bonuses || {}),
      edge: { ...((base.property_bonuses || {}).edge || {}), ...((json.property_bonuses || {}).edge || {}) },
      node: { ...((base.property_bonuses || {}).node || {}), ...((json.property_bonuses || {}).node || {}) },
    },
    normalisation: { ...(base.normalisation || {}), ...(json.normalisation || {}) },
    display_policy: { ...(base.display_policy || {}), ...(json.display_policy || {}) },
  };

  return {
    weights,
    source: WEIGHTS_GCS_URI,
    version: typeof weights.version === 'string' ? weights.version : 'unknown',
    updated_utc: typeof weights.updated_utc === 'string' ? weights.updated_utc : '',
    note: '',
  };
}

async function getWeights() {
  const now = Date.now();
  const ttlMs = WEIGHTS_TTL_SECONDS * 1000;

  if (_weightsCache && (now - _weightsCache.loadedAtMs) < ttlMs) {
    return { ..._weightsCache, fromCache: true, err: _weightsCacheErr };
  }

  try {
    const loaded = await loadWeightsFromGcs();
    _weightsCache = {
      loadedAtMs: now,
      weights: loaded.weights,
      source: loaded.source,
      version: loaded.version,
      updated_utc: loaded.updated_utc || '',
      note: loaded.note || '',
    };
    _weightsCacheErr = null;
    return { ..._weightsCache, fromCache: false, err: null };
  } catch (e) {
    _weightsCacheErr = String(e?.message || e);

    if (_weightsCache?.weights) {
      return { ..._weightsCache, fromCache: true, err: _weightsCacheErr };
    }

    const dw = defaultWeights();
    return {
      loadedAtMs: now,
      weights: dw,
      source: 'builtin',
      version: 'builtin-default',
      note: `Weights load failed; using built-in defaults.`,
      fromCache: false,
      err: _weightsCacheErr,
    };
  }
}

// ---- Helpers -------------------------------------------------------------

function clampInt(n, min, max, fallback) {
  const x = Number.parseInt(String(n), 10);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, x));
}

function safeStr(v) {
  return typeof v === 'string' ? v : '';
}

function prettyDateUtc(iso) {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' });
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeHtml(str) {
  return escapeHTML(str);
}

function stripExpertPrefix(q) {
  return q.replace(/^\s*x:\s*/i, '').trim();
}

function extractHopLimitFromText(q) {
  const m1 = q.match(/(?:<=|≤)\s*(\d{1,2})/);
  if (m1?.[1]) return clampInt(m1[1], 1, 25, 10);

  const m2 = q.match(/(\d{1,2})\s*(?:hops?|steps?)/i);
  if (m2?.[1]) return clampInt(m2[1], 1, 25, 10);

  return 10;
}

function buildChain(nodes, rels) {
  const chain = [];
  for (let i = 0; i < nodes.length; i++) {
    chain.push({ node: nodes[i] });
    if (i < rels.length) chain.push({ edge: { type: rels[i] } });
  }
  return chain;
}

async function llmExtractTerms(model, userQuery) {
  const prompt = `
Return ONLY valid JSON: {"x":"...","y":"..."}.
Extract the two target terms from the question. If unknown, return empty strings.

Question:
${userQuery}
`;
  const resp = await model.invoke(prompt);
  const text = typeof resp?.content === 'string' ? resp.content : String(resp?.content || '');

  const i = text.indexOf('{');
  const j = text.lastIndexOf('}');
  if (i === -1 || j === -1 || j <= i) return { x: '', y: '' };

  try {
    const json = JSON.parse(text.slice(i, j + 1));
    return { x: safeStr(json?.x).trim(), y: safeStr(json?.y).trim() };
  } catch {
    return { x: '', y: '' };
  }
}

function userMentionsWord(q, word) {
  return new RegExp(`\\b${word}\\b`, 'i').test(q);
}

// ---- Scoring -------------------------------------------------------------

function safeNum(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  const s = x.toFixed(3);
  return s.replace(/\.?0+$/, '');
}

function scorePath(nodes, rels, hopCount, weights) {
  const d = weights?.defaults || {};
  const nodeW = weights?.node_types || {};
  const edgeW = weights?.edge_types || {};
  const propBonus = weights?.property_bonuses || {};

  const baseNodeW = safeNum(d.node_weight, 0.40);
  const baseEdgeW = safeNum(d.edge_weight, 0.30);
  const basePropBonus = safeNum(d.property_bonus, 0.10);

  const hopDecayBase = safeNum(d.hop_decay, 0.85);
  const hopDecayLambda = safeNum(d.hop_decay_lambda, NaN);

  let sumNodes = 0;
  let sumAttr = 0;
  for (const n of nodes) {
    const typ = safeStr(n?.type);
    sumNodes += safeNum(nodeW[typ], baseNodeW);

    const keys = Array.isArray(n?.propKeys) ? n.propKeys : [];
    const nodeBonuses = propBonus?.node || {};
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(nodeBonuses, k)) {
        sumAttr += safeNum(nodeBonuses[k], basePropBonus);
      }
    }
  }

  let sumEdges = 0;
  let sumEdgeBonus = 0;
  for (const r of rels) {
    const typ = safeStr(r?.type);
    sumEdges += safeNum(edgeW[typ], baseEdgeW);

    const edgeBonuses = propBonus?.edge || {};
    const canonMap = edgeBonuses?.canonical || {};
    const canonVal = (r && typeof r.canonical === 'boolean') ? r.canonical : false;
    const canonKey = canonVal ? 'true' : 'false';
    if (Object.prototype.hasOwnProperty.call(canonMap, canonKey)) {
      sumEdgeBonus += safeNum(canonMap[canonKey], 0);
    }
  }

  const hops = Math.max(0, Number.isFinite(hopCount) ? hopCount : 0);

  let decay = 1;
  if (Number.isFinite(hopDecayLambda)) {
    decay = Math.exp(-hopDecayLambda * hops);
  } else {
    decay = Math.pow(hopDecayBase, hops);
  }

  const raw = (sumNodes + sumEdges + sumAttr + sumEdgeBonus) * decay;

  return {
    score_raw: raw,
    score_components: {
      sum_nodes: sumNodes,
      sum_edges: sumEdges,
      sum_attr: sumAttr,
      sum_edge_bonus: sumEdgeBonus,
      hop_count: hops,
      hop_decay: Number.isFinite(hopDecayLambda) ? `exp(-${hopDecayLambda}*hops)` : hopDecayBase,
      decay_multiplier: decay,
    },
  };
}

function normaliseMinMax(paths) {
  const scores = paths.map(p => safeNum(p.score_raw, 0));
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  if (!Number.isFinite(min) || !Number.isFinite(max) || scores.length === 0) {
    return paths.map(p => ({ ...p, score_norm: 0 }));
  }

  if (max === min) {
    return paths.map(p => ({ ...p, score_norm: scores[0] > 0 ? 1 : 0 }));
  }

  return paths.map((p, i) => {
    const s = scores[i];
    const norm = (s - min) / (max - min);
    return { ...p, score_norm: Math.max(0, Math.min(1, norm)) };
  });
}

function tierForScore(scoreNorm, tiers) {
  const t = tiers || {};
  const s = safeNum(scoreNorm, 0);

  const high = safeNum(t.high, 0.85);
  const medium = safeNum(t.medium, 0.65);
  const low = safeNum(t.low, 0.35);

  if (s >= high) return 'high';
  if (s >= medium) return 'medium';
  if (s >= low) return 'low';
  return 'minimal';
}

function sortPaths(paths) {
  return (paths || []).slice().sort((a, b) => {
    const sb = safeNum(b.score_norm, 0) - safeNum(a.score_norm, 0);
    if (sb !== 0) return sb;
    const hb = safeNum(a.hop_count, 0) - safeNum(b.hop_count, 0);
    if (hb !== 0) return hb;
    return 0;
  });
}

function groupPathsByTier(paths) {
  const groups = { high: [], medium: [], low: [], minimal: [] };
  for (const p of (paths || [])) {
    const k = safeStr(p?.tier) || 'minimal';
    if (!groups[k]) groups[k] = [];
    groups[k].push(p);
  }
  return groups;
}

function buildEvidenceHtml(paths, hopLimitUsed, maxPathsToShow, weightsMeta) {
  const top = Array.isArray(paths) ? paths.slice(0, maxPathsToShow) : [];
  if (!top.length) return '';

  const weightsLine = weightsMeta && weightsMeta.version
    ? `Semantic Evidence Weights ${escapeHtml(`${weightsMeta.version}`)}, updated ${escapeHtml(weightsMeta.updatedPretty || '')}`
    : '';

  function tierToLabel(tier) {
    if (tier === 'high') return 'High Semantic Evidence';
    if (tier === 'medium') return 'Medium Semantic Evidence';
    if (tier === 'low') return 'Low Semantic Evidence';
    return 'Minimal Evidence';
  }

  const html = top.map((p, i) => {
    const hops = safeNum(p.hop_count, 0);
    const tier = safeStr(p.tier || 'minimal');
    const score10 = Math.round(safeNum(p.score_norm, 0) * 100) / 10;
    const sewTitle = `${score10.toFixed(1)} ${tierToLabel(tier)}`;

    const metaBits = [
      `<span class="ont-hop">${escapeHtml(String(hops))} hops</span>`,
      `<span class="ont-edge">${escapeHtml(tier)}</span>`,
      `<span class="ont-edge"><strong>${escapeHtml(sewTitle)}</strong></span>`
    ];

    const parts = [];
    const nodes = Array.isArray(p.nodes) ? p.nodes : [];
    const rels = Array.isArray(p.rels) ? p.rels : [];

    for (let ni = 0; ni < nodes.length; ni++) {
      const n = nodes[ni] || {};
      const nLabel = safeStr(n.label || '(unnamed)');
      const nType = safeStr(n.type || 'Concept');
      const nId = safeStr(n.id || '');

      parts.push(
        `<span class="ont-node" data-type="${escapeHtml(nType)}" data-id="${escapeHtml(nId)}">${escapeHtml(nLabel)}</span>`
      );

      if (ni < rels.length) {
        parts.push(`<span class="ont-arrow" aria-hidden="true">→</span>`);
      }
    }

    const chainHtml = parts.join(' ');

    const c = p.score_components || {};
    const calcHtml = `
<div class="sew-calc">
  <div class="sew-calc-row">
    <span class="sew-calc-kv"><strong>raw</strong> ${escapeHtml(fmtNum(p.score_raw))}</span>
    <span class="sew-calc-kv"><strong>normalised</strong> ${escapeHtml(fmtNum(p.score_norm))}</span>
    <span class="sew-calc-kv"><strong>hops</strong> ${escapeHtml(String(c.hop_count ?? hops))}</span>
    <span class="sew-calc-kv"><strong>decay</strong> ${escapeHtml(fmtNum(c.decay_multiplier))}</span>
  </div>
  <div class="sew-calc-row">
    <span class="sew-calc-kv"><strong>Σnodes</strong> ${escapeHtml(fmtNum(c.sum_nodes))}</span>
    <span class="sew-calc-kv"><strong>Σedges</strong> ${escapeHtml(fmtNum(c.sum_edges))}</span>
    <span class="sew-calc-kv"><strong>Σattrs</strong> ${escapeHtml(fmtNum(c.sum_attr))}</span>
    <span class="sew-calc-kv"><strong>Σedge bonus</strong> ${escapeHtml(fmtNum(c.sum_edge_bonus))}</span>
  </div>
  ${weightsLine ? `<div class="sew-calc-row"><span class="bimei-tiny">${escapeHtml(weightsLine)}</span></div>` : ``}
</div>`;

    return `
<div class="ont-path" data-path-index="${i + 1}">
  <div class="ont-path-meta">${metaBits.join(' ')}</div>
  <section class="ont-evidence">${chainHtml}</section>
  <details class="sew-details">
    <summary>Expand score calculation</summary>
    ${calcHtml}
  </details>
</div>`;
  }).join('\n');

  return `<div class="bimei-evidence-block"><span class="bimei-evidence-title">Evidence</span>${html}<span class="bimei-tiny">BIMei Knowledge Graph (v0.260106 JSON)</span></div>`;
}

// ---- Function ------------------------------------------------------------

exports.graphQuery = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).send('');

  const rawQuestion = safeStr(req.body?.query || req.query?.query).trim();
  if (!rawQuestion) return res.status(400).send({ error: "Missing 'query' parameter." });

  const trace = safeStr(req.get?.('x-cloud-trace-context') || '');

  const out = {
    status: '',
    answer: '',
    source: 'BIMei Knowledge Graph',
    hop_limit_used: 0,
    resolved_candidates: { x: [], y: [] },
    paths: [],
    neighbourhood: { x: [], y: [] },
    weights_version: '',
    weights_source: '',
    weights_updated_utc: '',
    debug: { message: '', neo4j_error: '', cypher: '', trace },
    paths_by_tier: { high: [], medium: [], low: [], minimal: [] },
    paths_count: 0,
    paths_shown: 0,
    evidence_html: '',
    graph_data: null,
    evidence: null,
  };

  let graph = null;

  try {
    const w = await getWeights();
    const weights = w.weights;
    out.weights_version = safeStr(w.version);
    out.weights_source = safeStr(w.source);
    out.weights_updated_utc = safeStr(w.updated_utc);
    if (w.note) out.debug.message = w.note;
    if (w.err) out.debug.message = (out.debug.message ? out.debug.message + ' | ' : '') + `Weights load error: ${w.err}`;

    graph = await Neo4jGraph.initialize({
      url: NEO4J_URI,
      username: NEO4J_USERNAME,
      password: NEO4J_PASSWORD,
    });

    const questionNoPrefix = stripExpertPrefix(rawQuestion);
    const hop = extractHopLimitFromText(questionNoPrefix);
    const hopLiteral = clampInt(hop, 1, 25, 10);
    out.hop_limit_used = hopLiteral;

    const model = new ChatVertexAI({
      model: process.env.VERTEX_MODEL || 'gemini-2.5-pro',
      temperature: 0,
    });

    const terms = await llmExtractTerms(model, questionNoPrefix);

    let xTerm = terms.x;
    let yTerm = terms.y;

    if (!xTerm || !yTerm) {
      const m = questionNoPrefix.match(/between\s+(.+?)\s+and\s+(.+?)(?:\s*[?.!]|$)/i);
      if (m?.[1] && m?.[2]) {
        xTerm = xTerm || m[1].trim();
        yTerm = yTerm || m[2].trim();
      }
    }

    if (!xTerm || !yTerm) {
      out.status = 'TERM_NOT_FOUND';
      out.debug.message = out.debug.message
        ? out.debug.message + ' | Could not reliably extract X and Y terms from the question.'
        : 'Could not reliably extract X and Y terms from the question.';
      return res.status(200).send(out);
    }

    const candCypher = `
WITH toLower($term) AS t
MATCH (n)
WITH n, t,
  coalesce(n.name, n.title, n.label, n.canonicalTitle, '') AS s
WHERE s <> '' AND toLower(s) CONTAINS t
WITH n, t, s,
  CASE
    WHEN toLower(s) = t THEN 3
    WHEN toLower(s) STARTS WITH t THEN 2
    ELSE 1
  END AS matchRank,
  head(labels(n)) AS typ
RETURN
  toString(id(n)) AS id,
  typ AS type,
  s AS label,
  matchRank AS matchRank
ORDER BY matchRank DESC, size(s) ASC
LIMIT 10
`;

    const xRows = await graph.query(candCypher, { term: xTerm });
    const yRows = await graph.query(candCypher, { term: yTerm });

    const xCands = (xRows || []).map(r => ({
      id: safeStr(r.id),
      type: safeStr(r.type),
      label: safeStr(r.label),
      matchRank: typeof r.matchRank === 'number' ? r.matchRank : 0,
    }));

    const yCands = (yRows || []).map(r => ({
      id: safeStr(r.id),
      type: safeStr(r.type),
      label: safeStr(r.label),
      matchRank: typeof r.matchRank === 'number' ? r.matchRank : 0,
    }));

    const preferTypes = [
      'InformationUse',
      'KnowledgeSet',
      'Construct',
      'DictionaryItem',
      'ActionStatement',
      'Resource',
      'Deliverable',
      'Content',
    ];
    const typeWeight = new Map(preferTypes.map((t, i) => [t, 100 - i * 10]));
    const penaliseListStuff = !userMentionsWord(questionNoPrefix, 'list');

    function scoreCandidate(c) {
      let score = (c.matchRank || 0) * 1000;
      score += typeWeight.get(c.type) || 0;

      const labelLower = c.label.toLowerCase();
      if (penaliseListStuff) {
        if (labelLower.includes(' list')) score -= 250;
        if (labelLower.includes('211in')) score -= 300;
        if (labelLower.includes('greek')) score -= 200;
      }
      if (c.type === 'Deliverable') score -= 150;
      score += Math.max(0, 50 - Math.min(50, c.label.length));
      return score;
    }

    function sortAndTrim(arr) {
      return arr
        .map(c => ({ ...c, _score: scoreCandidate(c) }))
        .sort((a, b) => (b._score - a._score))
        .slice(0, 5)
        .map(({ _score, ...rest }) => rest);
    }

    const xTop = sortAndTrim(xCands);
    const yTop = sortAndTrim(yCands);

    out.resolved_candidates.x = xTop.map(({ matchRank, ...c }) => c);
    out.resolved_candidates.y = yTop.map(({ matchRank, ...c }) => c);

    if (!out.resolved_candidates.x.length || !out.resolved_candidates.y.length) {
      out.status = 'TERM_NOT_FOUND';
      out.debug.message = out.debug.message
        ? out.debug.message + ' | One or both terms did not resolve to any candidate nodes.'
        : 'One or both terms did not resolve to any candidate nodes.';
      return res.status(200).send(out);
    }

    const xBest = out.resolved_candidates.x[0];
    const yBest = out.resolved_candidates.y[0];

    const canonicalRels = ['PART_OF', 'IS_COMPOSED_OF', 'EXPRESSED_AS', 'ABOUT', 'MENTIONS', 'MEASURES', 'INSTANCE_OF'];

    // Progressive search: try increasing hops to find canonical relationships
    let paths = [];
    let searchHops = 1;
    const maxSearchHops = Math.min(hopLiteral, 10);
    
    while (searchHops <= maxSearchHops && paths.length === 0) {
      const pathCypherCanonical = `
MATCH (a) WHERE id(a) = toInteger($idA)
MATCH (b) WHERE id(b) = toInteger($idB)
MATCH p = allShortestPaths((a)-[*..${searchHops}]-(b))
WHERE all(r IN relationships(p) WHERE type(r) IN $canonical)
RETURN
  length(p) AS hop_count,
  [n IN nodes(p) | {
    id: toString(id(n)),
    type: head(labels(n)),
    label: coalesce(n.name, n.title, n.label, n.canonicalTitle, n.id, '(unnamed)')
  }] AS nodes,
  [r IN relationships(p) | type(r)] AS rels
LIMIT 2
`;

      out.debug.message = (out.debug.message ? out.debug.message + ' | ' : '') +
        `Canonical search at ${searchHops} hops`;

      const rows = await graph.query(pathCypherCanonical, {
        idA: xBest.id,
        idB: yBest.id,
        canonical: canonicalRels,
      });

      paths = (rows || []).map(r => {
        const nodes = Array.isArray(r.nodes) ? r.nodes : [];
        const rels = Array.isArray(r.rels) ? r.rels : [];
        const hopCount = typeof r.hop_count === 'number' ? r.hop_count : rels.length;

        const chain = buildChain(nodes, rels);
        const score = scorePath(nodes, rels, hopCount, weights);

        return {
          hop_count: hopCount,
          nodes,
          rels,
          chain,
          score_raw: score.score_raw,
          score_norm: 0,
          score_components: score.score_components,
        };
      });
      
      searchHops++;
    }

    // If no canonical paths found, return error message
    if (paths.length === 0) {
      out.status = 'NO_PATH';
      out.answer = `Could not find canonical relationships between "${(out.resolved_candidates?.x?.[0]?.label) || 'X'}" and "${(out.resolved_candidates?.y?.[0]?.label) || 'Y'}" within ${maxSearchHops} hops. Only canonical relationship types (PART_OF, MEASURES, EXPRESSED_AS, etc.) are supported.`;
      return res.status(200).send(out);
    }

    const finalHasChain = paths.length > 0 && paths.some(p => Array.isArray(p.chain) && p.chain.length > 0);
    if (finalHasChain) {
      let normed = normaliseMinMax(paths);

      normed = normed.map(p => ({
        ...p,
        tier: tierForScore(p.score_norm, weights?.tiers),
      }));

      normed = sortPaths(normed);

      const dp = weights?.display_policy || {};
      const maxShown = clampInt(dp.max_paths_shown, 1, 25, 3);

      out.paths = normed;
      out.paths_by_tier = groupPathsByTier(normed);
      out.paths_count = normed.length;
      out.paths_shown = Math.min(maxShown, normed.length);

      const weightsMeta = { version: safeStr(out.weights_version || ''), updatedPretty: prettyDateUtc(out.weights_updated_utc || '') };

      out.evidence_html = buildEvidenceHtml(normed, out.hop_limit_used, out.paths_shown, weightsMeta);

      // NEW: Add structured data - always extract from evidence_html
      const firstPath = normed[0] || {};
      let graphNodes = [];
      let graphEdges = [];
      
      // Extract unique nodes from all paths to avoid duplicates
      const nodeMap = new Map();
      for (const path of normed) {
        if (path.nodes && Array.isArray(path.nodes)) {
          for (const node of path.nodes) {
            if (node.id && !nodeMap.has(node.id)) {
              nodeMap.set(node.id, {
                id: node.id,
                type: node.type || 'Unknown',
                label: node.label || node.id
              });
            }
          }
        }
      }
      graphNodes = Array.from(nodeMap.values());
      
      // Create edges from first path relationships
      if (firstPath.rels && Array.isArray(firstPath.rels) && firstPath.nodes && Array.isArray(firstPath.nodes)) {
        for (let i = 0; i < firstPath.rels.length && i < firstPath.nodes.length - 1; i++) {
          graphEdges.push({
            source: firstPath.nodes[i].id,
            relation: firstPath.rels[i] || 'CONNECTS_TO',
            target: firstPath.nodes[i + 1].id
          });
        }
      }
      
      // Fallback: extract from evidence_html if nodes/edges are empty
      if (graphNodes.length === 0 && out.evidence_html) {
        const nodeMatches = out.evidence_html.match(/<span class="ont-node"[^>]*data-type="([^"]+)"[^>]*data-id="([^"]+)"[^>]*>([^<]+)<\/span>/g);
        if (nodeMatches) {
          const seenIds = new Set();
          graphNodes = nodeMatches.map(match => {
            const typeMatch = match.match(/data-type="([^"]+)"/);
            const idMatch = match.match(/data-id="([^"]+)"/);
            const labelMatch = match.match(/>([^<]+)<\/span>/);
            const id = idMatch ? idMatch[1] : '';
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              return {
                id: id,
                type: typeMatch ? typeMatch[1] : '',
                label: labelMatch ? labelMatch[1] : ''
              };
            }
            return null;
          }).filter(Boolean);
          
          graphEdges = Array(Math.max(0, graphNodes.length - 1)).fill(null).map((_, i) => ({
            source: graphNodes[i].id,
            relation: 'CONNECTS_TO',
            target: graphNodes[i + 1].id
          }));
        }
      }
      
      out.graph_data = {
        nodes: graphNodes,
        edges: graphEdges
      };

      out.evidence = {
        score: firstPath.score_norm ? Math.round(firstPath.score_norm * 100) / 10 : 0,
        confidence: firstPath.tier === 'high' ? 'High' : firstPath.tier === 'medium' ? 'Medium' : 'Low',
        semantic_type: 'Semantic Evidence',
        metrics: {
          hops: firstPath.hop_count || 0,
          raw: firstPath.score_raw || 0,
          normalised: firstPath.score_norm || 0,
          decay: (firstPath.score_components && firstPath.score_components.decay_multiplier) || 0
        }
      };

      const labelX = (out.resolved_candidates?.x?.[0]?.label) || 'X';
      const labelY = (out.resolved_candidates?.y?.[0]?.label) || 'Y';
      
      out.answer_clean = `Found ${out.paths.length} path(s) between "${labelX}" and "${labelY}".`;

      out.status = 'PATH_FOUND';
      out.answer = `Found ${out.paths.length} path(s) between "${labelX}" and "${labelY}".`;
      return res.status(200).send(out);
    }

    out.paths = [];
    out.status = 'NO_PATH';
    out.answer = '';
    return res.status(200).send(out);

  } catch (err) {
    const hadPaths = Array.isArray(out.paths) && out.paths.length > 0;
    out.status = hadPaths ? 'PATH_FOUND' : 'ERROR';
    out.debug.message = (out.debug.message ? out.debug.message + ' | ' : '') + (hadPaths ? 'Path search succeeded but evidence rendering failed' : 'GraphQuery failed');
    out.debug.neo4j_error = String(err?.message || err);
    return res.status(200).send(out);
  } finally {
    try { if (graph) await graph.close(); } catch {}
  }
};

// Export for Cloud Functions
module.exports = { graphQuery: exports.graphQuery };

// Named export for direct calls
const graphQueryHandler = exports.graphQuery;