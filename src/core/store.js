// Estado global único — toda a aplicação parte daqui
// Nunca distribuir estado crítico por múltiplos stores

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { classifyCharacters, buildCoOccurrenceRelations, extractCharacterVoice } from '../utils/script-enrichment.js'

const SCHEMA_VERSION = '1.0.0'

// Estrutura base de um projecto
const projectDefaults = {
  universe:  { chars: [], arcs: [], rules: [], glossary: [], writersRoom: [] },
  scripts:   {},
  schedule:  { days: [], scenes: [], constraints: {} },
  budget:    { envelopes: {}, lines: [], suppliers: [], history: [] },
  team:      { members: [], substitutes: {}, roles: {} },
  locations: {},
  continuity: { wardrobe: {}, props: {}, notes: [] },
  postProduction: { editing: {}, audio: {}, vfx: {}, grading: {} },
  dates:     { milestones: [], deliveries: [] },
  log:       { decisions: [], incidents: [], changes: [] },
}

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Schema version ────────────────────────────────────────
      _version: SCHEMA_VERSION,

      // ── Auth ──────────────────────────────────────────────────
      auth: {
        user: null,         // { name, email, photo, uid }
        role: null,         // role ID from roles.js
        department: null,   // department ID
        projectIds: [],
        isAuthenticated: false,
        isSuperAdmin: false,   // vista de deus — todos os projectos
        lang: 'pt',            // língua da UI (pt, en, es, fr) — por user
        theme: 'dark',         // 'dark' | 'light' — por user
        previewPanel: null,    // 'management' | 'roleview' | null — preview mode para admins
        previewRole: null,     // role simulado no preview mode
      },

      // ── Nome do projecto ──────────────────────────────────────
      projectName: '',
      projectFps: 25,
      projectTheme: null,  // { image, colors: { bg, surface, elevated, accent, accentLight, text, textSecondary, textMuted }, fonts: { display, body }, generatedAt }

      // ── Wallpaper ────────────────────────────────────────────
      wallpaper: {
        type: 'none',        // 'none' | 'preset' | 'custom' | 'gradient'
        preset: null,        // preset ID string
        customUrl: null,     // base64 or URL for custom image
        gradient: null,      // CSS gradient string
        blur: 20,            // backdrop blur amount in px (for glass effect)
        opacity: 0.85,       // surface opacity (0=fully transparent, 1=opaque)
        dim: 0.3,            // image dim overlay (0=bright, 1=dark)
      },

      // ── Equipa global ─────────────────────────────────────────
      team: [],  // [{ id, name, role, group, company, phone, email, photo, notes, availability, characterName, agent, driveLinks[], dietary?, parkingSpot? }]

      // ── Locais ────────────────────────────────────────────────
      locations: [], // [{ id, name, displayName, type, status, address, lat, lng, contact, accessNotes, notes, photos:{before,scene,after}, driveLinks[], fromScript }]

      // ── Planeamento de Rodagem ────────────────────────────────
      shootingDays: [],          // [{ id, date, label, notes, callTime, catering?:{time,location,menu[],provider}, parking?:[{memberId,spot,floor}] }]
      rsvp: {},                    // { [dayId]: { [memberId]: { status:'confirmed'|'declined'|'pending', menuChoice?, openedAt } } }
      callsheetNotes: {},          // { [dayId]: { [deptId]: string } } — notas por departamento na folha de serviço
      sceneAnnotations: {},        // { [sceneKey]: { angles: [{ id, lens, fStop, notes, rating, iso, focal }], continuityNotes: string } } — anotações da script supervisor
      sceneAssignments: {},      // { [sceneKey]: dayId }  sceneKey = `${epId}-${sceneNumber}`
      sceneTakes: {},            // { [sceneKey]: [{ id, status, notes, timestamp }] }  status: bom|parcial|repetir
      sceneTags: {},             // { [sceneKey]: string[] } — tags/características (croma, stunts, sfx, etc.)

      // ── Dados extraídos dos guiões ────────────────────────────
      parsedCharacters: [],   // [{ name, scenes, lineCount }]
      parsedLocations:  [],   // [string]
      parsedScripts:    {},   // { [epId]: parsedResult }

      // ── Módulo de Agendamento ─────────────────────────────────
      scheduleMode:           'creative',  // 'creative' | 'budget'
      scheduleBudgetEnvelope: null,        // máx dias em modo orçamental
      scheduleVersions:       [],          // snapshots guardados do plano

      // ── Parâmetros do projecto ────────────────────────────────
      projectParams: {
        episodes:        '',   // nº de episódios
        episodeDuration: '',   // duração em minutos
        shootDays:       '',   // dias de rodagem totais
      },

      // ── Orçamento ─────────────────────────────────────────────────
      budgets: [],          // array de orçamentos completos
      suppliers: [],        // base de dados de fornecedores
      budgetVersions: {},   // { [budgetId]: [snapshots] }
      budgetDocuments: [],  // repositório de docs financeiros [{ id, filename, type, extractedText, uploadedAt, tags[], category, notes }]

      // ── Universo ──────────────────────────────────────────────────────
      universe: {
        chars: [],          // [{ id, name, arcType, group, description, notes, x, y, photo, age, occupation, backstory, arc, relations[], voice:{when,what,example}, traits[], roomNotes, universeRule }]
        relations: [],      // [{ from, to, type, label }]
        arcs: [],           // [{ id, charId, episodes: { [epId]: { present, role, note } } }]
        bible: {
          logline: '', genre: '', tone: '', themes: '', text: '',
          sections: [],     // [{ id, title, text, order }] — secções dinâmicas (Tom & Voz, Influências, Regras de Escrita, etc.)
        },
        glossary: [],       // [{ id, term, definition, category }]
        writersRoom: [],    // [{ id, role, content, timestamp }]  role: 'user'|'assistant'
        forces: [],         // [{ id, num, title, text, color, reference }] — regras do universo
        episodeArcs: [],    // [{ id, epNum, title, phase, phaseColor, desire, description, anchorScene, notes }]
        decisions: [],      // [{ id, title, description, urgency:'alta'|'média'|'baixa', options:[{id,label,text}], status:'open'|'decided', chosenOption, createdAt }]
        files: [],          // [{ id, filename, type, extractedText, rawContent, uploadedAt, tags[], linkedTo:{type,id}|null, notes }]
      },

      // ── Continuidade (migrada de localStorage) ──────────────
      continuityData: {},      // { [sceneKey]: { wardrobe, props, makeup, notes, photos[] } }
      continuityDecisions: [], // [{ id, scene, decision, category, importance, timestamp }]

      // ── Departamentos (Look Book) ──────────────────────────
      // Cada item: { id, department, characterId?, locationId?, scenes[], photos[], notes, approved, createdAt, wardrobeRepeat? }
      // wardrobeRepeat (wardrobe only): { enabled, scope:'scene-block'|'episode'|'multi-episode'|'series', episodeRange[], exceptions[], exceptionsNote, variants[{id,name,sceneKeys[],condition:'clean'|'dirty'|'damaged'|'wet'|'alternate',photos[],notes}] }
      departmentItems: [],
      // Departamentos disponíveis com meta
      departmentConfig: [
        { id: 'wardrobe',    label: 'Guarda-Roupa',    color: '#A02E6F', icon: 'shirt' },
        { id: 'art',         label: 'Arte / Décor',    color: '#2EA080', icon: 'palette' },
        { id: 'props',       label: 'Adereços',        color: '#BF6A2E', icon: 'package' },
        { id: 'makeup',      label: 'Caracterização',  color: '#7B4FBF', icon: 'sparkles' },
        { id: 'hair',        label: 'Cabelo',          color: '#5B8DEF', icon: 'scissors' },
        { id: 'sfx',         label: 'Efeitos Especiais', color: '#F87171', icon: 'flame' },
        { id: 'vehicles',    label: 'Veículos',        color: '#6E6E78', icon: 'car' },
        { id: 'stunts',      label: 'Stunts',          color: '#E11D48', icon: 'zap' },
        { id: 'camera',      label: 'Câmara',          color: '#2E6FA0', icon: 'camera' },
        { id: 'lighting',    label: 'Iluminação',      color: '#F5A623', icon: 'lightbulb' },
        { id: 'sound',       label: 'Som',             color: '#22C55E', icon: 'mic' },
        { id: 'vfx',         label: 'VFX',             color: '#8B5CF6', icon: 'wand' },
      ],

      // ── Sugestões cruzadas (impacto entre módulos) ──────────
      // [{ id, type, source, target, title, description, data, status:'pending'|'approved'|'dismissed', createdAt }]
      suggestions: [],

      // ── Audit trail do ReactiveCore ─────────────────────────
      // [{ id, ruleId, source, target, description, auto, data, timestamp }]
      reactiveAudit: [],

      // ── Captures ─────────────────────────────────────────────
      // [{ id, type, base64Key, textContent, interpretation, questions, answers, status, capturedAt, destinations }]
      captures: [],

      // Notas gerais de capture (destinos sem módulo dedicado)
      captureNotes: [], // [{ id, categoria, descricao, texto, base64Key, timestamp, answers }]

      // ── Dailies ─────────────────────────────────────────────────
      // Clips de câmara importados para review
      dailies: {
        cameras: [],   // [{ camera, cameraModel, clipCount, totalDuration, clips: [{ id, filename, dur, fps, durationSec, durationDisplay, resolution, videoType, audioType, channels, umid, createdAt }] }]
        clipMeta: {},  // { [clipId]: { rating, notes, sceneId, selected, inPoint, outPoint, clapFrame } }
        audioTracks: [], // [{ id, filename, sampleRate, channels, durationSec, timecodeStart, clapFrame, linkedClipIds[] }]
      },

      // ── Camera Reports (por dia de rodagem) ──────────────────
      // { [dayId]: [ { id, cameraId, camera, cardNumber, storageMedia, backupStatus, backupDestination, clips[] } ] }
      cameraReports: {},

      // ── Guião de Produção ──────────────────────────────────────
      // Camada de produção sobre o guião literário
      productionScript: {
        versao_atual: 'v1',
        versoes: [],        // [{ id, importadoEm, importadoPor, fonte, alteracoes_vs_anterior[] }]
        cenas: {},          // { [sceneKey]: { estado, picks_pendentes[], notas_realizador[], notas_continuidade[], sequencia_id, dia_rodagem, bloco_horario, hora_prevista, versao_guiao } }
        sequencias: [],     // [{ id, nome, cor, cenas[], descricao, arco_emocional, dias_de_rodagem[], tem_costura, costuras[] }]
        costuras: [],       // [{ id, sequencia_id, cena_antes, cena_depois, dia_antes, dia_depois, intervalo_dias, checklist[], notas }]
      },
      sidesGerados: [],     // [{ id, tipo, destinatario_id, episodio_id, dia, versao_guiao, gerado_em, codigo_rastreio, link_token, aberto_em, num_acessos, status }]

      // ── Convites (Join by Invite Link) ─────────────────────────
      invites: [],  // [{ id, token, role, department, label, createdBy, createdAt, expiresAt, usedBy, usedAt, maxUses, uses }]

      // ── API Keys ──────────────────────────────────────────────
      apiKey: '',
      owmApiKey: '',   // OpenWeatherMap API key (meteorologia)

      // ── Pré-Produção ──────────────────────────────────────────
      preProduction: {
        shootDate:         '',
        teamMembers:       [],
        tasks:             [],
        castingStatus:     {},  // { [charName]: 'a contactar'|'em audição'|'confirmado'|'contratado' }
        castingDetails:    {},  // { [charName]: { actorName, contact, notes } }
        crewStatus:        {},  // { [roleId]: { name, status, contact, notes, coversRoles[] } }
        locationSubStatus: {},  // { [loc]: { autorização, recce } }
        locationDetails:   {},  // { [loc]: { address, contact, notes } }
      },

      // ── Projecto activo ───────────────────────────────────────
      currentProjectId: null,

      // ── Todos os projectos ────────────────────────────────────
      projects: {},

      // ── UI global ─────────────────────────────────────────────
      ui: {
        activeModule:    'dashboard',  // dashboard | universe | pre-production | ...
        activeSubModule: null,
        sidebarOpen:       false,
        mobileSidebarOpen: false,
        activeDay:         null,
        modals:          {},           // { [id]: boolean }
        notifications:   [],
        deepLinkSceneId: null,         // sceneId para deep-link no guião completo
      },

      // ── Acções: Auth ──────────────────────────────────────────
      login: (user, role, department = null, isSuperAdmin = false) => set(state => ({
        auth: { ...state.auth, user, role, department, isAuthenticated: true, isSuperAdmin, previewPanel: null, previewRole: null },
      })),

      logout: () => set(state => ({
        auth: { user: null, role: null, department: null, projectIds: [], isAuthenticated: false, isSuperAdmin: false, lang: state.auth.lang || 'pt', theme: state.auth.theme || 'dark', previewPanel: null, previewRole: null },
        currentProjectId: null,
        ui: { ...useStore.getState().ui, activeModule: 'dashboard' },
      })),

      // Preview mode — admins podem ver a app como qualquer role
      setPreviewPanel: (panel) => set(state => ({
        auth: { ...state.auth, previewPanel: panel },
      })),
      setPreviewRole: (role) => set(state => ({
        auth: { ...state.auth, previewRole: role },
      })),
      exitPreview: () => set(state => ({
        auth: { ...state.auth, previewPanel: null, previewRole: null },
      })),

      setLang: (lang) => set(state => ({
        auth: { ...state.auth, lang },
      })),

      setTheme: (theme) => set(state => ({
        auth: { ...state.auth, theme },
      })),

      // ── Seed Demo Data (Desdobrado) ───────────────────────────
      seedDemoData: () => {
        const id = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const team = [
          { id: id(), name: 'João Silva', role: 'Realizador', group: 'Realização', phone: '+351 912 345 678', email: 'joao@desdobrado.pt', characterName: null, photo: null, cacheDiario: 800, nif: '234567890', confirmedDays: [] },
          { id: id(), name: 'Ana Martins', role: 'Directora de Produção', group: 'Produção', phone: '+351 913 456 789', email: 'ana@desdobrado.pt', characterName: null, photo: null, cacheDiario: 650, nif: '345678901', confirmedDays: [] },
          { id: id(), name: 'Rui Teixeira', role: 'Director de Fotografia', group: 'Câmara', phone: '+351 914 567 890', email: 'rui@desdobrado.pt', characterName: null, photo: null, cacheDiario: 700, nif: '456789012', confirmedDays: [] },
          { id: id(), name: 'Helena Rodrigues', role: 'Directora de Arte', group: 'Arte', phone: '+351 915 432 108', email: 'helena@desdobrado.pt', characterName: null, photo: null, cacheDiario: 550, nif: '567890123', confirmedDays: [] },
          { id: id(), name: 'Miguel Costa', role: '1º Assistente de Realização', group: 'Realização', phone: '+351 916 789 012', email: 'miguel@desdobrado.pt', characterName: null, photo: null, cacheDiario: 500, nif: '678901234', confirmedDays: [] },
          { id: id(), name: 'Carla Mendes', role: 'Script Supervisor', group: 'Realização', phone: '+351 917 890 123', email: 'carla@desdobrado.pt', characterName: null, photo: null, cacheDiario: 400, nif: '789012345', confirmedDays: [] },
          { id: id(), name: 'Pedro Santos', role: 'Director de Som', group: 'Som', phone: '+351 918 901 234', email: 'pedro@desdobrado.pt', characterName: null, photo: null, cacheDiario: 500, nif: '890123456', confirmedDays: [] },
          { id: id(), name: 'Inês Marques', role: 'Set Decorator', group: 'Arte', phone: '+351 919 012 345', email: 'ines@desdobrado.pt', characterName: null, photo: null, cacheDiario: 350, nif: '901234567', confirmedDays: [] },
          { id: id(), name: 'Fernando Dias', role: 'Gaffer', group: 'Iluminação', phone: '+351 920 123 456', email: 'fernando@desdobrado.pt', characterName: null, photo: null, cacheDiario: 400, nif: '012345678', confirmedDays: [] },
          { id: id(), name: 'Sofia Almeida', role: 'Figurinista', group: 'Guarda-Roupa', phone: '+351 921 234 567', email: 'sofia@desdobrado.pt', characterName: null, photo: null, cacheDiario: 400, nif: '123456780', confirmedDays: [] },
          { id: id(), name: 'Diogo Ferreira', role: 'Câmara Operator', group: 'Câmara', phone: '+351 922 345 678', email: 'diogo@desdobrado.pt', characterName: null, photo: null, cacheDiario: 450, nif: '234567801', confirmedDays: [] },
          { id: id(), name: 'Mariana Lopes', role: 'Maquilhadora', group: 'Caracterização', phone: '+351 923 456 789', email: 'mariana@desdobrado.pt', characterName: null, photo: null, cacheDiario: 350, nif: '345678012', confirmedDays: [] },
          // Elenco
          { id: id(), name: 'Ricardo Pereira', role: 'Actor Principal', group: 'Elenco', phone: '+351 930 111 222', email: 'ricardo@mail.pt', characterName: 'MARCO', photo: null, cacheDiario: 1200, confirmedDays: [] },
          { id: id(), name: 'Beatriz Monteiro', role: 'Actriz Principal', group: 'Elenco', phone: '+351 930 222 333', email: 'beatriz@mail.pt', characterName: 'CLARA', photo: null, cacheDiario: 1100, confirmedDays: [] },
          { id: id(), name: 'Tomás Ribeiro', role: 'Actor', group: 'Elenco', phone: '+351 930 333 444', email: 'tomas@mail.pt', characterName: 'NUNO', photo: null, cacheDiario: 800, confirmedDays: [] },
          { id: id(), name: 'Leonor Vasconcelos', role: 'Actriz', group: 'Elenco', phone: '+351 930 444 555', email: 'leonor@mail.pt', characterName: 'TERESA', photo: null, cacheDiario: 800, confirmedDays: [] },
          { id: id(), name: 'André Oliveira', role: 'Actor', group: 'Elenco', phone: '+351 930 555 666', email: 'andre@mail.pt', characterName: 'INSPECTOR VALE', photo: null, cacheDiario: 900, confirmedDays: [] },
        ]

        const locations = [
          { id: id(), name: 'Delegacia Central', displayName: 'INT. Delegacia - Gabinete', type: 'interior', status: 'confirmado', address: 'Rua de Santa Catarina 412, Porto', city: 'Porto', contact: 'Sr. Moreira — 226 001 234', accessNotes: 'Entrar pelo portão lateral. Estacionamento na cave.', notes: 'Precisa de decoração: secretárias, dossiers, quadro de cortiça', lat: 41.1496, lng: -8.6109 },
          { id: id(), name: 'Apartamento da Clara', displayName: 'INT. Apartamento Clara', type: 'interior', status: 'confirmado', address: 'Rua do Almada 205, 3ºD, Porto', city: 'Porto', contact: 'D. Fernanda — 912 555 000', accessNotes: 'Chave com a porteira. Elevador avariado.', notes: 'Sala + quarto. Decoração moderna, minimalista.', lat: 41.1480, lng: -8.6140 },
          { id: id(), name: 'Café Guarany', displayName: 'INT. Café', type: 'interior', status: 'confirmado', address: 'Av. dos Aliados 85, Porto', city: 'Porto', contact: 'Gerente: Paulo — 222 321 272', accessNotes: 'Filmar antes das 10h ou depois das 23h', notes: 'Art Deco original. Não mover mobiliário fixo.', lat: 41.1488, lng: -8.6107 },
          { id: id(), name: 'Rua da Perseguição', displayName: 'EXT. Rua Estreita', type: 'exterior', status: 'confirmado', address: 'Travessa de Cedofeita, Porto', city: 'Porto', contact: 'Junta de Freguesia — 222 089 700', accessNotes: 'Licença CMP necessária. Corte de trânsito 06h-14h.', notes: 'Calçada portuguesa, iluminação pública bonita à noite', lat: 41.1520, lng: -8.6200 },
          { id: id(), name: 'Jardim do Palácio', displayName: 'EXT. Jardim', type: 'exterior', status: 'em_negociação', address: 'Jardins do Palácio de Cristal, Porto', city: 'Porto', contact: 'Câmara do Porto — Divisão de Eventos', accessNotes: 'Só com autorização CMP. Sem drones.', notes: 'Vista panorâmica do Douro. Árvores centenárias.', lat: 41.1482, lng: -8.6274 },
          { id: id(), name: 'Tribunal', displayName: 'INT. Tribunal - Sala Audiências', type: 'interior', status: 'confirmado', address: 'Palácio da Justiça, Porto', city: 'Porto', contact: 'Dr. Sá Carneiro — 222 007 500', accessNotes: 'Filmar sábados e domingos. Segurança obrigatória.', notes: 'Sala solene com madeira escura. Acústica seca.', lat: 41.1463, lng: -8.6100 },
          { id: id(), name: 'Carro do Marco', displayName: 'INT/EXT. Carro', type: 'veículo', status: 'confirmado', address: 'BMW Série 3 Cinzento — Aluguer AutoClassic', city: 'Porto', contact: 'AutoClassic — 220 998 877', accessNotes: 'Levantar dia anterior', notes: 'Matrícula falsa preparada por Arte', lat: null, lng: null },
          { id: id(), name: 'Escadaria da Sé', displayName: 'EXT. Escadaria', type: 'exterior', status: 'confirmado', address: 'Terreiro da Sé, Porto', city: 'Porto', contact: 'Diocese do Porto', accessNotes: 'Permissão eclesiástica + CMP. Sem fumo artificial.', notes: 'Perseguição a pé. Escadas íngremes — stunts atenção.', lat: 41.1430, lng: -8.6110 },
        ]

        const days = [
          { id: 'day1', date: '2025-03-15', dayNumber: 1, label: 'D1', callTime: '06:30', notes: 'Primeiro dia. Delegacia + interrogatório.', episodeNumber: 1, dayInEpisode: 1, catering: { time: '12:30', location: 'Área de Catering — Piso 0', provider: 'CaterPorto', menu: ['Bacalhau à Brás', 'Frango grelhado', 'Vegetariano'] } },
          { id: 'day2', date: '2025-03-17', dayNumber: 2, label: 'D2', callTime: '07:00', notes: 'Apartamento Clara + Café', episodeNumber: 1, dayInEpisode: 2 },
          { id: 'day3', date: '2025-03-18', dayNumber: 3, label: 'D3', callTime: '07:00', notes: 'Exterior rua + perseguição', episodeNumber: 1, dayInEpisode: 3 },
          { id: 'day4', date: '2025-03-19', dayNumber: 4, label: 'D4', callTime: '08:00', notes: 'Jardim + carro', episodeNumber: 1, dayInEpisode: 4 },
          { id: 'day5', date: '2025-03-20', dayNumber: 5, label: 'D5', callTime: '07:00', notes: 'Tribunal + escadaria', episodeNumber: 1, dayInEpisode: 5 },
        ]

        const scenes = {
          'EP01': {
            id: 'EP01', title: 'Episódio 1 — Desdobrado',
            scenes: [
              { id: 'SC001', sceneNumber: '1', location: 'Delegacia Central', intExt: 'INT', timeOfDay: 'DIA', description: 'Marco chega à delegacia. Primeiro dia como inspector.', characters: ['MARCO', 'INSPECTOR VALE'], pageCount: 2.5 },
              { id: 'SC002', sceneNumber: '2', location: 'Delegacia Central', intExt: 'INT', timeOfDay: 'DIA', description: 'Interrogatório tenso. Suspeito não colabora.', characters: ['MARCO', 'NUNO'], pageCount: 3.0 },
              { id: 'SC003', sceneNumber: '3', location: 'Apartamento da Clara', intExt: 'INT', timeOfDay: 'NOITE', description: 'Clara espera Marco. Jantar frio na mesa.', characters: ['CLARA'], pageCount: 1.5 },
              { id: 'SC004', sceneNumber: '4', location: 'Café Guarany', intExt: 'INT', timeOfDay: 'DIA', description: 'Marco encontra Teresa. Ela tem informação crucial.', characters: ['MARCO', 'TERESA'], pageCount: 2.0 },
              { id: 'SC005', sceneNumber: '5', location: 'Rua da Perseguição', intExt: 'EXT', timeOfDay: 'DIA', description: 'Perseguição a pé pelo centro do Porto.', characters: ['MARCO', 'NUNO'], pageCount: 4.0 },
              { id: 'SC006', sceneNumber: '6', location: 'Apartamento da Clara', intExt: 'INT', timeOfDay: 'NOITE', description: 'Marco chega tarde. Discussão com Clara.', characters: ['MARCO', 'CLARA'], pageCount: 2.5 },
              { id: 'SC007', sceneNumber: '7', location: 'Jardim do Palácio', intExt: 'EXT', timeOfDay: 'DIA', description: 'Encontro secreto no jardim. Teresa revela a verdade.', characters: ['MARCO', 'TERESA', 'INSPECTOR VALE'], pageCount: 3.0 },
              { id: 'SC008', sceneNumber: '8', location: 'Carro do Marco', intExt: 'INT', timeOfDay: 'NOITE', description: 'Marco sozinho no carro. Chamada misteriosa.', characters: ['MARCO'], pageCount: 1.0 },
              { id: 'SC009', sceneNumber: '9', location: 'Tribunal', intExt: 'INT', timeOfDay: 'DIA', description: 'Audiência preliminar. Tensão entre advogados.', characters: ['MARCO', 'NUNO', 'INSPECTOR VALE', 'TERESA'], pageCount: 5.0 },
              { id: 'SC010', sceneNumber: '10', location: 'Escadaria da Sé', intExt: 'EXT', timeOfDay: 'DIA', description: 'Confronto final na escadaria. Nuno tenta fugir.', characters: ['MARCO', 'NUNO'], pageCount: 3.5 },
            ],
          },
        }

        const assignments = {
          'EP01-SC001': 'day1', 'EP01-SC002': 'day1',
          'EP01-SC003': 'day2', 'EP01-SC004': 'day2', 'EP01-SC006': 'day2',
          'EP01-SC005': 'day3',
          'EP01-SC007': 'day4', 'EP01-SC008': 'day4',
          'EP01-SC009': 'day5', 'EP01-SC010': 'day5',
        }

        const takes = {
          'EP01-SC001': [
            { id: id(), status: 'BOM', notes: 'Performance excelente. USAR ESTE.', timestamp: '2025-03-15T09:45:00' },
            { id: id(), status: 'parcial', notes: 'Boa mas barulho de fundo', timestamp: '2025-03-15T09:30:00' },
          ],
          'EP01-SC002': [
            { id: id(), status: 'BOM', notes: 'Tensão perfeita', timestamp: '2025-03-15T14:20:00' },
            { id: id(), status: 'repetir', notes: 'Esqueceu fala', timestamp: '2025-03-15T14:00:00' },
            { id: id(), status: 'parcial', notes: 'Bom mas cortar no fim', timestamp: '2025-03-15T14:10:00' },
          ],
        }

        const deptItems = [
          { id: id(), department: 'wardrobe', name: 'Fato Marco — Delegacia', characterId: null, scenes: ['EP01-SC001', 'EP01-SC002'], photos: [], notes: 'Fato cinzento escuro, camisa branca, sem gravata', approved: true, createdAt: new Date().toISOString() },
          { id: id(), department: 'wardrobe', name: 'Vestido Clara — Noite', characterId: null, scenes: ['EP01-SC003', 'EP01-SC006'], photos: [], notes: 'Vestido casual azul marinho, descalça em casa', approved: true, createdAt: new Date().toISOString() },
          { id: id(), department: 'wardrobe', name: 'Casaco Marco — Exterior', characterId: null, scenes: ['EP01-SC005', 'EP01-SC007', 'EP01-SC010'], photos: [], notes: 'Trench coat bege, usado na perseguição — duplicar para stunts', approved: false, createdAt: new Date().toISOString() },
          { id: id(), department: 'art', name: 'Mesa de Conferência', characterId: null, scenes: ['EP01-SC002'], photos: [], notes: 'Mesa rectangular, 4 cadeiras, cinzeiro, dossiers', approved: true, createdAt: new Date().toISOString() },
          { id: id(), department: 'art', name: 'Decoração Apartamento Clara', characterId: null, scenes: ['EP01-SC003', 'EP01-SC006'], photos: [], notes: 'Estante com livros, plantas, fotos emolduradas', approved: true, createdAt: new Date().toISOString() },
          { id: id(), department: 'props', name: 'Dossier do Caso', characterId: null, scenes: ['EP01-SC001', 'EP01-SC002', 'EP01-SC009'], photos: [], notes: 'Dossier castanho com fotos e relatórios falsos. 3 cópias.', approved: true, createdAt: new Date().toISOString() },
          { id: id(), department: 'props', name: 'Telemóvel Marco', characterId: null, scenes: ['EP01-SC008'], photos: [], notes: 'iPhone com ecrã falso customizado. Prop master tem backup.', approved: true, createdAt: new Date().toISOString() },
          { id: id(), department: 'camera', name: 'Setup A — Delegacia Wide', characterId: null, scenes: ['EP01-SC001'], photos: [], notes: 'Sony FX6 + 24mm T1.5 — tripé alto, ângulo dominante', approved: true, createdAt: new Date().toISOString() },
          { id: id(), department: 'camera', name: 'Setup B — Interrogatório Close', characterId: null, scenes: ['EP01-SC002'], photos: [], notes: 'Sony FX6 + 85mm T1.3 — slider, foco no rosto', approved: true, createdAt: new Date().toISOString() },
          { id: id(), department: 'lighting', name: 'Iluminação Delegacia', characterId: null, scenes: ['EP01-SC001', 'EP01-SC002'], photos: [], notes: 'Fluorescentes práticas + Arri SkyPanel key. Tom frio.', approved: true, createdAt: new Date().toISOString() },
          { id: id(), department: 'sound', name: 'Setup Som Delegacia', characterId: null, scenes: ['EP01-SC001', 'EP01-SC002'], photos: [], notes: 'Boom + 2x lapela DPA. Ambiente sala de espera.', approved: true, createdAt: new Date().toISOString() },
          { id: id(), department: 'makeup', name: 'Look Marco Base', characterId: null, scenes: ['EP01-SC001', 'EP01-SC002', 'EP01-SC004', 'EP01-SC005'], photos: [], notes: 'Natural, barba de 2 dias, olheiras subtis', approved: true, createdAt: new Date().toISOString() },
        ]

        set({
          projectName: 'DESDOBRADO',
          team,
          locations,
          shootingDays: days,
          parsedScripts: scenes,
          sceneAssignments: assignments,
          sceneTakes: takes,
          departmentItems: deptItems,
          parsedCharacters: [
            { name: 'MARCO', scenes: ['SC001','SC002','SC004','SC005','SC006','SC007','SC008','SC009','SC010'], lineCount: 145 },
            { name: 'CLARA', scenes: ['SC003','SC006'], lineCount: 38 },
            { name: 'NUNO', scenes: ['SC002','SC005','SC009','SC010'], lineCount: 52 },
            { name: 'TERESA', scenes: ['SC004','SC007','SC009'], lineCount: 35 },
            { name: 'INSPECTOR VALE', scenes: ['SC001','SC007','SC009'], lineCount: 28 },
          ],
          parsedLocations: ['Delegacia Central', 'Apartamento da Clara', 'Café Guarany', 'Rua da Perseguição', 'Jardim do Palácio', 'Tribunal', 'Carro do Marco', 'Escadaria da Sé'],
          projectParams: { episodes: '6', episodeDuration: '52', shootDays: '45' },
        })
      },

      // ── Acções: Convites ───────────────────────────────────────
      createInvite: ({ role, department, label, maxUses = 1, expiresInDays = 7 }) => {
        const token = Math.random().toString(36).slice(2) + Date.now().toString(36)
        const invite = {
          id: `inv_${Date.now()}`,
          token,
          role,
          department: department || null,
          label: label || '',
          createdBy: get().auth.user?.email || 'admin',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + expiresInDays * 86400000).toISOString(),
          usedBy: [],
          maxUses,
          uses: 0,
        }
        set(state => ({ invites: [...state.invites, invite] }))
        return invite
      },

      useInvite: (token, user) => {
        const invite = get().invites.find(i => i.token === token)
        if (!invite) return { error: 'Convite não encontrado' }
        if (invite.uses >= invite.maxUses) return { error: 'Convite já foi utilizado' }
        if (new Date(invite.expiresAt) < new Date()) return { error: 'Convite expirado' }

        set(state => ({
          invites: state.invites.map(i =>
            i.token === token
              ? { ...i, uses: i.uses + 1, usedBy: [...i.usedBy, { ...user, usedAt: new Date().toISOString() }] }
              : i
          ),
        }))

        return { ok: true, role: invite.role, department: invite.department, label: invite.label }
      },

      revokeInvite: (inviteId) => set(state => ({
        invites: state.invites.filter(i => i.id !== inviteId),
      })),

      // ── Acções: Projectos ─────────────────────────────────────
      createProject: (meta) => {
        const id = `proj_${Date.now()}`
        set(state => ({
          projects: {
            ...state.projects,
            [id]: { id, meta, settings: {}, ...projectDefaults },
          },
          currentProjectId: id,
        }))
        return id
      },

      setCurrentProject: (id) => set({ currentProjectId: id }),

      // ── Acções: UI ────────────────────────────────────────────
      navigate: (module, subModule = null) => set(state => ({
        ui: { ...state.ui, activeModule: module, activeSubModule: subModule, deepLinkSceneId: null },
      })),

      navigateToScene: (sceneId) => set(state => ({
        ui: { ...state.ui, activeModule: 'script', deepLinkSceneId: sceneId },
      })),

      clearDeepLink: () => set(state => ({
        ui: { ...state.ui, deepLinkSceneId: null },
      })),

      toggleSidebar: () => set(state => ({
        ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
      })),

      toggleMobileSidebar: () => set(state => ({
        ui: { ...state.ui, mobileSidebarOpen: !state.ui.mobileSidebarOpen },
      })),
      closeMobileSidebar: () => set(state => ({
        ui: { ...state.ui, mobileSidebarOpen: false },
      })),

      addNotification: (notification) => set(state => ({
        ui: {
          ...state.ui,
          notifications: [
            { id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`, type: 'info', read: false, timestamp: Date.now(), ...notification },
            ...state.ui.notifications,
          ].slice(0, 50), // máximo 50
        },
      })),

      markNotificationRead: (id) => set(state => ({
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.map(n => n.id === id ? { ...n, read: true } : n),
        },
      })),

      markAllNotificationsRead: () => set(state => ({
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.map(n => ({ ...n, read: true })),
        },
      })),

      clearNotifications: () => set(state => ({
        ui: { ...state.ui, notifications: [] },
      })),

      setProjectName: (name) => set({ projectName: name }),
      setProjectFps: (fps) => set({ projectFps: fps }),
      setProjectTheme: (theme) => set({ projectTheme: theme }),
      clearProjectTheme: () => set({ projectTheme: null }),
      setWallpaper: (patch) => set(state => ({
        wallpaper: { ...state.wallpaper, ...patch },
      })),
      // ── Pré-Produção ──────────────────────────────────────────
      setProjectParams: (patch) => set(state => ({
        projectParams: { ...state.projectParams, ...patch },
      })),

      // Quando um guião é confirmado — popula personagens, locais e universo
      populateFromScript: (parsed) => set(state => {
        // Personagens únicos (merge com existentes)
        const existingNames = new Set(state.parsedCharacters.map(c => c.name))
        const newChars = (parsed.metadata?.characters || []).filter(c => !existingNames.has(c.name))

        // Locais únicos extraídos das cenas
        const existingLocs = new Set(state.parsedLocations)
        const newLocs = (parsed.scenes || [])
          .map(s => s.location).filter(Boolean)
          .filter(l => !existingLocs.has(l))
        const uniqueNewLocs = [...new Set(newLocs)]

        // Auto-sync: criar entradas no universo para personagens novas
        const universeCharNames = new Set((state.universe.chars || []).map(c => c.name))
        const newUniverseChars = newChars
          .filter(c => !universeCharNames.has(c.name))
          .map(c => ({
            id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: c.name,
            arcType: '',
            group: '',
            description: '',
            notes: `Auto-importada do guião (${c.scenes?.length || 0} cenas, ${c.lineCount || 0} falas)`,
            x: Math.random() * 600 + 100,
            y: Math.random() * 400 + 100,
            traits: [],
            relations: [],
          }))

        // Auto-merge detected scene tags from parser
        const tagUpdates = {}
        ;(parsed.scenes || []).forEach(sc => {
          if (sc.autoTags && sc.autoTags.length > 0) {
            const sk = `${parsed.episode}-${sc.sceneNumber || sc.id}`
            const existing = state.sceneTags[sk] || []
            const merged = [...new Set([...existing, ...sc.autoTags])]
            if (merged.length > existing.length) tagUpdates[sk] = merged
          }
        })

        // Merge new scripts for enrichment
        const allScripts = { ...state.parsedScripts, [parsed.episode]: parsed }
        const allUniChars = [...(state.universe.chars || []), ...newUniverseChars]

        // ── Auto-enrich: classify arcType, scale, voice, build relations ──
        const classifications = classifyCharacters(allScripts)
        const coRelations = buildCoOccurrenceRelations(allScripts)

        // Apply classifications (only to chars with empty arcType — never overwrite manual)
        const CX = 400, CY = 300
        const scaleRadius = { centro: 0, real: 120, social: 200, liminar: 280, metafisico: 340, sobrenatural: 380 }
        const enrichedChars = allUniChars.map(c => {
          const nameUp = (c.name || '').toUpperCase()
          const classif = classifications[nameUp]
          if (!classif) return c
          const patch = {}
          if (!c.arcType) patch.arcType = classif.arcType
          if (!c.scale)   patch.scale   = classif.scale
          patch.scriptStats = {
            sceneCount: classif.sceneCount,
            wordCount: classif.wordCount,
            ...classif.dialogueStats,
          }
          if (!c.voice?.when && !c.voice?.what) {
            const voice = extractCharacterVoice(allScripts, c.name)
            if (voice) patch.voice = voice
          }
          return Object.keys(patch).length > 0 ? { ...c, ...patch } : c
        })

        // Position by scale rings
        const byScale = {}
        for (const c of enrichedChars) {
          const s = c.scale || 'liminar'
          if (!byScale[s]) byScale[s] = []
          byScale[s].push(c)
        }
        const positioned = enrichedChars.map(c => {
          const s = c.scale || 'liminar'
          const ring = byScale[s] || []
          const idx = ring.indexOf(c)
          const r = scaleRadius[s] || 200
          if (s === 'centro') return { ...c, x: CX, y: CY }
          const angle = (2 * Math.PI * idx) / ring.length - Math.PI / 2
          return { ...c, x: Math.round(CX + r * Math.cos(angle)), y: Math.round(CY + r * Math.sin(angle)) }
        })

        // Merge co-occurrence relations with existing (don't duplicate)
        const existingRels = state.universe.relations || []
        const existingPairs = new Set(existingRels.map(r => {
          const a = (r.from || '').toUpperCase(), b = (r.to || '').toUpperCase()
          return a < b ? `${a}|${b}` : `${b}|${a}`
        }))
        const nameToId = {}
        for (const c of positioned) nameToId[(c.name || '').toUpperCase()] = c.id
        const newRels = coRelations
          .filter(r => {
            const a = r.from.toUpperCase(), b = r.to.toUpperCase()
            const key = a < b ? `${a}|${b}` : `${b}|${a}`
            return !existingPairs.has(key) && nameToId[a] && nameToId[b]
          })
          .map(r => ({ from: nameToId[r.from.toUpperCase()], to: nameToId[r.to.toUpperCase()], type: r.type, label: r.label }))

        return {
          parsedCharacters: [...state.parsedCharacters, ...newChars],
          parsedLocations:  [...state.parsedLocations,  ...uniqueNewLocs],
          parsedScripts:    allScripts,
          universe: { ...state.universe, chars: positioned, relations: [...existingRels, ...newRels] },
          ...(Object.keys(tagUpdates).length > 0
            ? { sceneTags: { ...state.sceneTags, ...tagUpdates } }
            : {}),
        }
      }),

      setParsedScripts: (scripts) => set({ parsedScripts: scripts }),

      setShootDate: (date) => set(state => ({
        preProduction: { ...state.preProduction, shootDate: date },
      })),
      addTask: (task) => set(state => ({
        preProduction: { ...state.preProduction, tasks: [...state.preProduction.tasks, task] },
      })),
      updateTask: (id, patch) => set(state => ({
        preProduction: {
          ...state.preProduction,
          tasks: state.preProduction.tasks.map(t => t.id === id ? { ...t, ...patch } : t),
        },
      })),
      removeTask: (id) => set(state => ({
        preProduction: { ...state.preProduction, tasks: state.preProduction.tasks.filter(t => t.id !== id) },
      })),

      setCastingStatus: (name, status) => set(state => {
        const update = {
          preProduction: {
            ...state.preProduction,
            castingStatus: { ...state.preProduction.castingStatus, [name]: status },
          },
        }

        // Auto-sync: quando um actor é contratado, criar membro na equipa se não existir
        if (status === 'contratado') {
          const alreadyInTeam = state.team.some(m =>
            m.characterName === name || m.name === (state.preProduction.castingDetails[name]?.actorName || '')
          )
          if (!alreadyInTeam) {
            const det = state.preProduction.castingDetails[name] || {}
            const newMember = {
              id: `tm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              name:          det.actorName || name,
              role:          'Actor',
              group:         'Elenco',
              characterName: name,
              phone:         det.contact || '',
              email:         '',
              notes:         det.notes || '',
              photo:         '',
              availability:  'available',
              agent:         '',
              driveLinks:    [],
              origem:        'casting-sync',
            }
            update.team = [...state.team, newMember]
          }
        }

        return update
      }),

      setCrewMember: (roleId, patch) => set(state => ({
        preProduction: {
          ...state.preProduction,
          crewStatus: {
            ...state.preProduction.crewStatus,
            [roleId]: { ...(state.preProduction.crewStatus[roleId] || {}), ...patch },
          },
        },
      })),

      setCastingDetail: (name, patch) => set(state => ({
        preProduction: {
          ...state.preProduction,
          castingDetails: {
            ...state.preProduction.castingDetails,
            [name]: { ...(state.preProduction.castingDetails[name] || {}), ...patch },
          },
        },
      })),

      setLocationDetail: (loc, patch) => set(state => ({
        preProduction: {
          ...state.preProduction,
          locationDetails: {
            ...state.preProduction.locationDetails,
            [loc]: { ...(state.preProduction.locationDetails[loc] || {}), ...patch },
          },
        },
      })),

      setLocationSubStatus: (loc, field, status) => set(state => {
        const prev = state.preProduction.locationSubStatus[loc] || {}
        return {
          preProduction: {
            ...state.preProduction,
            locationSubStatus: {
              ...state.preProduction.locationSubStatus,
              [loc]: { ...prev, [field]: status },
            },
          },
        }
      }),

      setApiKey: (key) => set({ apiKey: key }),
      setOwmApiKey: (key) => set({ owmApiKey: key }),

      // ── Acções: Continuidade ──────────────────────────────────
      setContinuityScene: (sceneKey, data) => set(state => ({
        continuityData: { ...state.continuityData, [sceneKey]: data },
      })),
      addContinuityDecision: (d) => set(state => ({
        continuityDecisions: [...state.continuityDecisions, d],
      })),
      removeContinuityDecision: (id) => set(state => ({
        continuityDecisions: state.continuityDecisions.filter(d => d.id !== id),
      })),

      // ── Acções: Departamentos ────────────────────────────────
      addDepartmentItem: (item) => {
        const newItem = { ...item, id: item.id || `dept_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, createdAt: new Date().toISOString() }
        set(state => ({ departmentItems: [...state.departmentItems, newItem] }))
        // Propagação movida para ReactiveCore (regra: dept-item→continuity)
      },
      updateDepartmentItem: (id, patch) => set(state => ({
        departmentItems: state.departmentItems.map(i => i.id === id ? { ...i, ...patch } : i),
      })),
      removeDepartmentItem: (id) => set(state => ({
        departmentItems: state.departmentItems.filter(i => i.id !== id),
      })),

      // ── Acções: Captures ──────────────────────────────────────
      addCapture: (capture) => set(state => ({
        captures: [...state.captures, capture],
      })),
      updateCapture: (id, patch) => set(state => ({
        captures: state.captures.map(c => c.id === id ? { ...c, ...patch } : c),
      })),
      removeCapture: (id) => set(state => ({
        captures: state.captures.filter(c => c.id !== id),
      })),

      // Destino genérico para tipos sem módulo dedicado
      // (guarda-roupa, prop, nota-realizador, recibo, casting, referencia)
      addCaptureNote: (note) => set(state => ({
        captureNotes: [...state.captureNotes, { ...note, savedAt: Date.now() }],
      })),
      // ── Acções: Camera Reports ──────────────────────────────
      setCameraReports: (dayId, reports) => set(state => ({
        cameraReports: { ...state.cameraReports, [dayId]: reports },
      })),
      // ── Acções: Dailies ──────────────────────────────────
      addDailiesCamera: (camera) => set(state => ({
        dailies: {
          ...state.dailies,
          cameras: [...(state.dailies?.cameras || []).filter(c => c.camera !== camera.camera), camera],
        },
      })),
      updateClipMeta: (clipId, patch) => set(state => ({
        dailies: {
          ...state.dailies,
          clipMeta: { ...(state.dailies?.clipMeta || {}), [clipId]: { ...((state.dailies?.clipMeta || {})[clipId] || {}), ...patch } },
        },
      })),
      addAudioTrack: (track) => set(state => ({
        dailies: {
          ...state.dailies,
          audioTracks: [...(state.dailies?.audioTracks || []), track],
        },
      })),
      clearDailies: () => set(state => ({
        dailies: { cameras: [], clipMeta: {}, audioTracks: [] },
      })),

      // ── Acções: Guião de Produção ──────────────────────────
      setSceneStatus: (sceneKey, estado) => set(state => ({
        productionScript: {
          ...state.productionScript,
          cenas: {
            ...state.productionScript.cenas,
            [sceneKey]: { ...(state.productionScript.cenas[sceneKey] || {}), estado },
          },
        },
      })),
      addSceneNote: (sceneKey, nota) => set(state => {
        const prev = state.productionScript.cenas[sceneKey] || {}
        return {
          productionScript: {
            ...state.productionScript,
            cenas: {
              ...state.productionScript.cenas,
              [sceneKey]: { ...prev, notas_realizador: [...(prev.notas_realizador || []), nota] },
            },
          },
        }
      }),
      setSequencias: (sequencias) => set(state => ({
        productionScript: { ...state.productionScript, sequencias },
      })),
      updateCosturaChecklist: (costuraId, idx, patch) => set(state => ({
        productionScript: {
          ...state.productionScript,
          costuras: state.productionScript.costuras.map(c =>
            c.id === costuraId
              ? { ...c, checklist: c.checklist.map((item, i) => i === idx ? { ...item, ...patch } : item) }
              : c
          ),
        },
      })),
      setScriptVersion: (versao, alteracoes = []) => set(state => ({
        productionScript: {
          ...state.productionScript,
          versao_atual: versao,
          versoes: [...state.productionScript.versoes, { id: versao, importadoEm: Date.now(), alteracoes_vs_anterior: alteracoes }],
        },
      })),

      // ── Acções: Sides ──────────────────────────────────────
      addSide: (side) => set(state => ({
        sidesGerados: [...state.sidesGerados, side],
      })),
      removeSide: (id) => set(state => ({
        sidesGerados: state.sidesGerados.filter(s => s.id !== id),
      })),
      invalidateSide: (id) => set(state => ({
        sidesGerados: state.sidesGerados.map(s =>
          s.id === id ? { ...s, status: 'desactualizado' } : s
        ),
      })),
      // ── Acções: Sugestões cruzadas ──────────────────────────
      addSuggestion: (s) => set(state => {
        // Evita duplicados do mesmo tipo+source+target
        const exists = state.suggestions.some(x => x.type === s.type && x.sourceId === s.sourceId && x.status === 'pending')
        if (exists) return {}
        return { suggestions: [...state.suggestions, { ...s, id: `sug_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, status: 'pending', createdAt: new Date().toISOString() }] }
      }),
      approveSuggestion: (id) => set(state => ({
        suggestions: state.suggestions.map(s => s.id === id ? { ...s, status: 'approved', approvedAt: new Date().toISOString() } : s),
      })),
      dismissSuggestion: (id) => set(state => ({
        suggestions: state.suggestions.map(s => s.id === id ? { ...s, status: 'dismissed' } : s),
      })),
      // ── Acções: ReactiveCore Audit ──────────────────────────
      addAuditEntry: (entry) => set(state => ({
        reactiveAudit: [
          { ...entry, id: `aud_${Date.now()}`, timestamp: new Date().toISOString() },
          ...state.reactiveAudit,
        ].slice(0, 100), // máximo 100 entradas
      })),

      // ── Acções: Orçamento Profissional ───────────────────────
      addBudget: (b) => set(s => ({ budgets: [...s.budgets, b] })),
      updateBudget: (id, patch) => set(s => ({ budgets: s.budgets.map(b => b.id === id ? { ...b, ...patch } : b) })),
      addBudgetExpense: (budgetId, expense) => set(s => ({
        budgets: s.budgets.map(b => b.id === budgetId
          ? { ...b, expenses: [...(b.expenses || []), expense] }
          : b),
      })),
      removeBudget: (id) => set(s => ({ budgets: s.budgets.filter(b => b.id !== id) })),
      addSupplier: (sup) => set(st => ({ suppliers: [...st.suppliers, sup] })),
      updateSupplier: (id, patch) => set(st => ({ suppliers: st.suppliers.map(s => s.id === id ? { ...s, ...patch } : s) })),
      removeSupplier: (id) => set(st => ({ suppliers: st.suppliers.filter(s => s.id !== id) })),
      saveBudgetVersion: (budgetId, label) => set(s => {
        const budget = s.budgets.find(b => b.id === budgetId)
        if (!budget) return {}
        const snapshot = { id: Date.now().toString(), label, savedAt: Date.now(), data: JSON.parse(JSON.stringify(budget)) }
        return { budgetVersions: { ...s.budgetVersions, [budgetId]: [...(s.budgetVersions[budgetId] || []), snapshot] } }
      }),

      // ── Acções: Documentos Financeiros ──────────────────────
      addBudgetDocument: (doc) => set(s => ({ budgetDocuments: [...s.budgetDocuments, doc] })),
      updateBudgetDocument: (id, patch) => set(s => ({ budgetDocuments: s.budgetDocuments.map(d => d.id === id ? { ...d, ...patch } : d) })),
      removeBudgetDocument: (id) => set(s => ({ budgetDocuments: s.budgetDocuments.filter(d => d.id !== id) })),

      // ── Acções: Locais ────────────────────────────────────────
      addLocation: (loc) => set(state => ({ locations: [...state.locations, loc] })),
      updateLocation: (id, patch) => {
        set(state => ({ locations: state.locations.map(l => l.id === id ? { ...l, ...patch } : l) }))
        // Propagação movida para ReactiveCore (regra: location-refused→production)
      },
      removeLocation: (id) => set(state => ({ locations: state.locations.filter(l => l.id !== id) })),

      // ── Acções: Schedule ─────────────────────────────────────
      setScheduleMode: (mode) => set({ scheduleMode: mode }),
      setScheduleBudgetEnvelope: (n) => set({ scheduleBudgetEnvelope: n }),
      saveScheduleVersion: (name) => set(state => ({
        scheduleVersions: [
          ...state.scheduleVersions,
          {
            id: `sv_${Date.now()}`,
            name,
            createdAt: new Date().toISOString(),
            shootingDays: state.shootingDays,
            sceneAssignments: state.sceneAssignments,
            mode: state.scheduleMode,
            envelope: state.scheduleBudgetEnvelope,
          },
        ],
      })),

      // ── Acções: Planeamento de Rodagem ────────────────────────
      addShootingDay: (day) => {
        set(state => ({ shootingDays: [...state.shootingDays, day] }))
        // Propagação movida para ReactiveCore (regra: day-add→budget)
      },
      updateShootingDay: (id, patch) => set(state => ({
        shootingDays: state.shootingDays.map(d => d.id === id ? { ...d, ...patch } : d),
      })),
      removeShootingDay: (id)  => set(state => {
        const newRsvp = { ...state.rsvp }
        delete newRsvp[id]
        return {
          shootingDays: state.shootingDays.filter(d => d.id !== id),
          sceneAssignments: Object.fromEntries(Object.entries(state.sceneAssignments).filter(([,v]) => v !== id)),
          rsvp: newRsvp,
        }
      }),

      // ── RSVP ─────────────────────────────────────────────────────
      updateRsvp: (dayId, memberId, data) => set(state => ({
        rsvp: {
          ...state.rsvp,
          [dayId]: {
            ...(state.rsvp[dayId] || {}),
            [memberId]: { ...(state.rsvp[dayId]?.[memberId] || {}), ...data },
          },
        },
      })),

      updateCallsheetNotes: (dayId, deptId, text) => set(state => ({
        callsheetNotes: {
          ...state.callsheetNotes,
          [dayId]: { ...(state.callsheetNotes[dayId] || {}), [deptId]: text },
        },
      })),

      updateSceneAnnotation: (sceneKey, patch) => set(state => ({
        sceneAnnotations: {
          ...state.sceneAnnotations,
          [sceneKey]: { ...(state.sceneAnnotations[sceneKey] || {}), ...patch },
        },
      })),

      sceneOrder: {},  // { [dayId]: [sceneKey, ...] } — ordem de rodagem dentro do dia

      assignScene: (sceneKey, dayId) => set(state => {
        const order = { ...state.sceneOrder }
        // Remove da ordem do dia anterior se existia
        Object.keys(order).forEach(did => {
          if (order[did]?.includes(sceneKey)) {
            order[did] = order[did].filter(k => k !== sceneKey)
          }
        })
        // Adiciona ao fim do novo dia
        order[dayId] = [...(order[dayId] || []), sceneKey]
        return {
          sceneAssignments: { ...state.sceneAssignments, [sceneKey]: dayId },
          sceneOrder: order,
        }
      }),
      unassignScene: (sceneKey) => set(state => {
        const a = { ...state.sceneAssignments }; delete a[sceneKey]
        const order = { ...state.sceneOrder }
        Object.keys(order).forEach(did => {
          if (order[did]?.includes(sceneKey)) {
            order[did] = order[did].filter(k => k !== sceneKey)
          }
        })
        return { sceneAssignments: a, sceneOrder: order }
      }),
      setSceneOrder: (dayId, keys) => set(state => ({
        sceneOrder: { ...state.sceneOrder, [dayId]: keys },
      })),
      // Batch: substituir todas as atribuições de uma vez (para auto-schedule)
      batchAssignScenes: (assignments) => set(state => {
        // assignments: { sceneKey: dayId }
        const order = {}
        Object.entries(assignments).forEach(([key, dayId]) => {
          if (!order[dayId]) order[dayId] = []
          order[dayId].push(key)
        })
        return { sceneAssignments: assignments, sceneOrder: order }
      }),
      addTake: (sceneKey, take) => set(state => ({
        sceneTakes: { ...state.sceneTakes, [sceneKey]: [...(state.sceneTakes[sceneKey] || []), take] },
      })),
      updateTake: (sceneKey, takeId, patch) => set(state => ({
        sceneTakes: {
          ...state.sceneTakes,
          [sceneKey]: (state.sceneTakes[sceneKey] || []).map(t => t.id === takeId ? { ...t, ...patch } : t),
        },
      })),
      removeTake: (sceneKey, takeId) => set(state => ({
        sceneTakes: {
          ...state.sceneTakes,
          [sceneKey]: (state.sceneTakes[sceneKey] || []).filter(t => t.id !== takeId),
        },
      })),

      // ── Acções: Scene Tags (características) ──────────────────────
      addSceneTag: (sceneKey, tag) => set(state => ({
        sceneTags: {
          ...state.sceneTags,
          [sceneKey]: [...new Set([...(state.sceneTags[sceneKey] || []), tag])],
        },
      })),
      removeSceneTag: (sceneKey, tag) => set(state => ({
        sceneTags: {
          ...state.sceneTags,
          [sceneKey]: (state.sceneTags[sceneKey] || []).filter(t => t !== tag),
        },
      })),

      // ── Acções: Equipa global ─────────────────────────────────
      addMember: (member) => {
        set(state => ({ team: [...state.team, member] }))
        // Propagação movida para ReactiveCore (regra: team-add→budget)
      },
      updateMember: (id, patch) => {
        set(state => ({
          team: state.team.map(m => m.id === id ? { ...m, ...patch } : m),
        }))
        // Propagação movida para ReactiveCore (regra: team-salary→budget)
      },
      removeMember: (id) => {
        set(state => ({ team: state.team.filter(m => m.id !== id) }))
        // Propagação movida para ReactiveCore (regra: team-remove→budget)
      },

      // ── Acções: Universo ──────────────────────────────────────
      setUniverseChars:     (chars)     => set(s => ({ universe: { ...s.universe, chars } })),
      setUniverseRelations: (relations) => set(s => ({ universe: { ...s.universe, relations } })),
      setUniverseArcs:      (arcs)      => set(s => ({ universe: { ...s.universe, arcs } })),
      setUniverseBible:     (patch)     => set(s => ({ universe: { ...s.universe, bible: { ...s.universe.bible, ...patch } } })),
      setUniverseGlossary:  (glossary)  => set(s => ({ universe: { ...s.universe, glossary } })),
      setUniverseForces:    (forces)    => set(s => ({ universe: { ...s.universe, forces } })),
      setUniverseEpisodeArcs: (episodeArcs) => set(s => ({ universe: { ...s.universe, episodeArcs } })),
      setUniverseDecisions:   (decisions)   => set(s => ({ universe: { ...s.universe, decisions } })),
      setUniverseFiles:       (files)       => set(s => ({ universe: { ...s.universe, files } })),
      addUniverseFile:        (file)        => set(s => ({ universe: { ...s.universe, files: [...(s.universe.files || []), file] } })),
      removeUniverseFile:     (id)          => set(s => ({ universe: { ...s.universe, files: (s.universe.files || []).filter(f => f.id !== id) } })),
      setBibleSections:       (sections)    => set(s => ({ universe: { ...s.universe, bible: { ...s.universe.bible, sections } } })),

    }),
    {
      name: 'frame-v3',
      version: 3,
      // Strip strings > 50KB from persist (base64 photos, raw file content, etc.)
      // Prevents localStorage overflow (5-10MB limit). Heavy data should use blobStore.js (IndexedDB).
      partialize: (state) => {
        let stripped = 0
        const cleaned = JSON.parse(JSON.stringify(state, (key, value) => {
          if (typeof value === 'string' && value.length > 50000) {
            stripped++
            return '[[blob]]'
          }
          return value
        }))
        if (stripped > 0) {
          console.warn(`[FRAME] partialize: stripped ${stripped} large string(s) from persist to avoid localStorage overflow`)
        }
        return cleaned
      },
      // Storage com protecção contra JSON corrompido
      storage: {
        getItem: (name) => {
          try {
            const raw = localStorage.getItem(name)
            if (!raw) return null
            return JSON.parse(raw)
          } catch (err) {
            console.error(`[FRAME] localStorage corrompido para "${name}":`, err.message)
            // Guardar backup antes de limpar
            try {
              const backup = localStorage.getItem(name)
              if (backup) localStorage.setItem(`${name}_backup_${Date.now()}`, backup)
            } catch (_) { /* ignore */ }
            localStorage.removeItem(name)
            return null
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value))
          } catch (err) {
            console.error(`[FRAME] Falha ao guardar state:`, err.message)
            if (err.name === 'QuotaExceededError') {
              console.error('[FRAME] localStorage CHEIO — dados pesados (fotos, ficheiros) devem usar blobStore.js (IndexedDB)')
            }
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
      // ao carregar: validar schema e migrar se necessário
      onRehydrateStorage: () => (state) => {
        if (state && state._version !== SCHEMA_VERSION) {
          console.warn(`[FRAME] Schema ${state._version} → ${SCHEMA_VERSION}: migração necessária`)
        }
        // Migrate OWM key from localStorage to store (one-time)
        if (state && !state.owmApiKey) {
          const legacyKey = localStorage.getItem('frame_owm_key')
          if (legacyKey) {
            state.owmApiKey = legacyKey
            useStore.setState({ owmApiKey: legacyKey })
            localStorage.removeItem('frame_owm_key')
            console.info('[FRAME] Migrated OWM API key from localStorage to store')
          }
        }
      },
    }
  )
)
