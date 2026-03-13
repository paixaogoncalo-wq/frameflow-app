// FRAME — Schedule Constraints (CSP-lite com backtracking limitado)
// O bin-packing com restrições é NP-hard (PITFALL 1 do brief).
// Esta implementação usa FFD + backtracking parcial:
//   1. FFD greedy como base
//   2. Se há violações, tenta permutar grupos entre dias (backtrack limitado)
//   3. Máx N tentativas antes de aceitar o melhor resultado
//
// Não é um CSP completo — é um melhoramento prático sobre o greedy puro.

import { capacidadeSegura, calcMoveTime } from './sceneDuration.js'
import { validateDay } from './scheduleRules.js'

const MAX_BACKTRACK_ATTEMPTS = 200
const MAX_SWAP_DEPTH = 3

// ── Verificar restrições de um grupo num dia ──────────────────────
export function verificarRestricoes(grupo, dia, gruposExistentes, team) {
  const violacoes = []

  // Todas as cenas do dia (existentes + candidato)
  const cenasExistentes = gruposExistentes.flatMap(g => g.scenes || [])
  const cenasComNovo = [...cenasExistentes, ...(grupo.scenes || [])]

  // Regra 1 — golden hour só se dia tem janela
  if (grupo.tem_golden) {
    const winType = dia.windowType || 'completo'
    if (winType !== 'golden_hour' && !dia.hasGoldenHourSlot) {
      violacoes.push({ rule: 'golden_hour_indisponivel', blocking: true })
    }
  }

  // Regra 2 — menores: horas acumuladas no dia
  if (grupo.tem_menor) {
    const menorMin = cenasComNovo
      .filter(s => s.hasMinor || (s.durationMods || []).some(m => m.key === 'menor'))
      .reduce((sum, s) => sum + (s.duration || 45), 0)
    const menorH = menorMin / 60
    if (menorH > 6) {
      violacoes.push({ rule: 'menor_limite_horas', blocking: true, horas: menorH })
    } else if (menorH >= 5.5) {
      violacoes.push({ rule: 'menor_alerta', blocking: false, horas: menorH })
    }
  }

  // Regra 3 — actores disponíveis
  if (dia.date && team) {
    const chars = [...new Set((grupo.scenes || []).flatMap(s => s.characters || []))]
    chars.forEach(charName => {
      const actor = team.find(m => m.characterName === charName || m.name === charName)
      if (!actor) return
      const avail = actor.availability || {}
      if (avail.dates?.length > 0 && !avail.dates.includes(dia.date)) {
        violacoes.push({ rule: `actor_indisponivel:${charName}`, blocking: true })
      }
      if (avail.unavailable?.includes(dia.date)) {
        violacoes.push({ rule: `actor_indisponivel:${charName}`, blocking: true })
      }
    })
  }

  // Regra 4 — exterior no meio do dia (alerta, não bloqueio)
  if (grupo.tem_exterior && !grupo.tem_golden) {
    const posicao = gruposExistentes.length
    const total = gruposExistentes.length + 1
    if (posicao > 0 && posicao < total - 1) {
      violacoes.push({ rule: 'exterior_meio_dia', blocking: false })
    }
  }

  const blocking = violacoes.filter(v => v.blocking)
  return {
    passa: blocking.length === 0,
    violacoes,
    alertas: violacoes.filter(v => !v.blocking),
  }
}

// ── Calcular score de qualidade de uma solução ────────────────────
function scoreSolution(dayGroups, days, team) {
  let score = 0
  let violations = 0

  Object.entries(dayGroups).forEach(([dayId, grupos]) => {
    const day = days.find(d => d.id === dayId)
    if (!day) return

    const scenes = grupos.flatMap(g => g.scenes || [])
    const validation = validateDay(day, scenes, team, {})

    // Menos violações = melhor
    violations += (validation.violations || []).length

    // Utilização equilibrada (ideal: 70-85%)
    const totalMin = scenes.reduce((s, sc) => s + (sc.duration || 45), 0)
    const cap = capacidadeSegura(day.windowType || 'completo')
    const util = cap > 0 ? (totalMin / cap) * 100 : 0

    if (util >= 70 && util <= 85) score += 10  // zona ideal
    else if (util >= 50 && util <= 90) score += 5
    else if (util > 90) score -= 5  // quase cheio
    else if (util > 0 && util < 40) score -= 3  // subutilizado
  })

  return score - violations * 20  // violações penalizam muito
}

// ── Tentar trocar um grupo entre dois dias ────────────────────────
function trySwap(dayGroups, dayA, dayB, groupIdx, days) {
  const gruposA = [...(dayGroups[dayA] || [])]
  const gruposB = [...(dayGroups[dayB] || [])]

  if (groupIdx >= gruposA.length) return null

  const grupo = gruposA[groupIdx]
  const dayBObj = days.find(d => d.id === dayB)
  if (!dayBObj) return null

  // Verificar se cabe no dia B
  const moveT = calcMoveTime()
  const currentLoadB = gruposB.reduce((s, g) => s + g.soma_duracao, 0)
    + gruposB.length * moveT.entreLocais
  const capB = capacidadeSegura(dayBObj.windowType || 'completo')
  const newMoveB = gruposB.length > 0 ? moveT.entreLocais : 0

  if (currentLoadB + grupo.soma_duracao + newMoveB > capB) return null

  // Fazer a troca
  const newA = gruposA.filter((_, i) => i !== groupIdx)
  const newB = [...gruposB, grupo]

  return {
    ...dayGroups,
    [dayA]: newA,
    [dayB]: newB,
  }
}

// ── CSP-lite: melhorar solução FFD com backtracking parcial ───────
export function optimizeWithBacktracking(initialDayGroups, days, team, overflow = []) {
  let bestSolution = { ...initialDayGroups }
  let bestScore = scoreSolution(bestSolution, days, team)
  let bestOverflow = [...overflow]
  let attempts = 0

  const dayIds = Object.keys(initialDayGroups)

  // Pass 1: tentar mover grupos do overflow para dias com espaço
  for (const grupo of overflow) {
    const moveT = calcMoveTime()

    for (const dayId of dayIds) {
      const dayObj = days.find(d => d.id === dayId)
      if (!dayObj) continue

      const existing = bestSolution[dayId] || []
      const currentLoad = existing.reduce((s, g) => s + g.soma_duracao, 0)
        + existing.length * moveT.entreLocais
      const cap = capacidadeSegura(dayObj.windowType || 'completo')
      const newMove = existing.length > 0 ? moveT.entreLocais : 0

      if (currentLoad + grupo.soma_duracao + newMove <= cap) {
        const check = verificarRestricoes(grupo, dayObj, existing, team)
        if (check.passa) {
          bestSolution[dayId] = [...existing, grupo]
          bestOverflow = bestOverflow.filter(g => g !== grupo)
          break
        }
      }
    }
  }

  // Pass 2: tentar swaps entre dias para melhorar score
  for (let i = 0; i < dayIds.length && attempts < MAX_BACKTRACK_ATTEMPTS; i++) {
    for (let j = i + 1; j < dayIds.length && attempts < MAX_BACKTRACK_ATTEMPTS; j++) {
      const gruposI = bestSolution[dayIds[i]] || []

      for (let g = 0; g < gruposI.length && attempts < MAX_BACKTRACK_ATTEMPTS; g++) {
        attempts++

        // Tentar mover grupo de dia i para dia j
        const swapped = trySwap(bestSolution, dayIds[i], dayIds[j], g, days)
        if (!swapped) continue

        const newScore = scoreSolution(swapped, days, team)
        if (newScore > bestScore) {
          bestSolution = swapped
          bestScore = newScore
        }

        // Tentar na direcção oposta também
        const gruposJ = bestSolution[dayIds[j]] || []
        for (let h = 0; h < gruposJ.length && attempts < MAX_BACKTRACK_ATTEMPTS; h++) {
          attempts++
          const swapped2 = trySwap(bestSolution, dayIds[j], dayIds[i], h, days)
          if (!swapped2) continue

          const newScore2 = scoreSolution(swapped2, days, team)
          if (newScore2 > bestScore) {
            bestSolution = swapped2
            bestScore = newScore2
          }
        }
      }
    }
  }

  return {
    dayGroups: bestSolution,
    overflow: bestOverflow,
    score: bestScore,
    attempts,
    improved: bestScore > scoreSolution(initialDayGroups, days, team),
  }
}

// ── Validar um drag-drop antes de aplicar ─────────────────────────
export function validateDragDrop(sceneKey, fromDayId, toDayId, engineResult, team) {
  const { days, assignments, allScenes } = engineResult
  const scene = allScenes.find(s => s.sceneKey === sceneKey)
  if (!scene) return { valid: false, message: 'Cena não encontrada' }

  const toDay = days.find(d => d.id === toDayId)
  if (!toDay) return { valid: false, message: 'Dia não encontrado' }

  // Verificar capacidade
  const moveT = calcMoveTime()
  const toScenes = (toDay.scenes || []).filter(s => s.sceneKey !== sceneKey)
  const currentLoad = toScenes.reduce((s, sc) => s + (sc.duration || 45), 0)
  const cap = capacidadeSegura(toDay.windowType || 'completo')
  const newLoad = currentLoad + (scene.duration || 45) + moveT.entreLocais

  if (newLoad > cap) {
    return {
      valid: false,
      message: `Dia ${toDay.label || toDayId} ficaria sobrecarregado (${Math.round(newLoad / cap * 100)}%)`,
    }
  }

  // Simular nova lista de cenas e validar regras
  const newScenes = [...toScenes, scene]
  const validation = validateDay(toDay, newScenes, team, {
    allAssignments: { ...assignments, [sceneKey]: toDayId },
  })

  const errors = (validation.violations || []).filter(v => v.severity === 'error')
  const warns = (validation.violations || []).filter(v => v.severity === 'warn')

  if (errors.length > 0) {
    return {
      valid: false,
      message: errors.map(e => e.message).join('; '),
      warnings: warns,
      canForce: true, // produtor pode forçar com aviso
    }
  }

  return {
    valid: true,
    warnings: warns,
    newUtilization: Math.round(newLoad / cap * 100),
  }
}
