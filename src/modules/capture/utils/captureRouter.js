// captureRouter.js — Encaminha um capture confirmado para o store correcto
// Versão 2: suporte a department-item com criação no departmentItems + continuidade

/**
 * Mapeia tipo → acção de store
 * @param {object} capture — { id, type, base64, textContent, interpretation, answers }
 * @param {object} answers — { [campo]: resposta }
 * @param {object} store — o store Zustand (resultado de useStore())
 * @returns {Array<{ module: string, label: string, success: boolean }>}
 */
export async function routeCapture(capture, answers, store) {
  const results = []
  const { interpretation = {} } = capture
  const tipo = interpretation.tipo || 'referencia'
  const destinos = interpretation.destinos_sugeridos || []

  // Helper para emitir sugestões cruzadas
  const suggest = (target, type, message, data = {}) => {
    if (typeof store.addSuggestion === 'function') {
      store.addSuggestion({
        id: `sug_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        source: 'capture',
        target,
        type,
        message,
        data: { ...data, captureId: capture.id },
        timestamp: Date.now(),
      })
    }
  }

  // Determinar destino primário
  const primaryDest = destinos[0]?.modulo || tipo
  const destino = answers?.destino_manual ? mapManualDest(answers.destino_manual) : primaryDest

  try {
    switch (destino) {
      // ── NOVO: department-item — cria item de departamento real ──────
      case 'department-item': {
        const dept = interpretation.department || 'props'
        const deptCfg = (store.departmentConfig || []).find(d => d.id === dept)
        const deptLabel = deptCfg?.label || dept

        // Para áudio/voz, usar a transcrição como descrição principal
        const isAudioCapture = capture.type === 'audio'
        const transcribedText = isAudioCapture && capture.textContent ? capture.textContent : null

        // Construir item de departamento
        const deptItem = {
          name: interpretation.name || interpretation.descricao || 'Item capturado',
          department: dept,
          characterName: interpretation.character || answers?.character || '',
          locationName: interpretation.location || answers?.location || '',
          scenes: interpretation.scene ? [interpretation.scene] : [],
          photos: [],
          notes: transcribedText || interpretation.descricao || capture.textContent || '',
          approved: false,
          fromCapture: true,
          captureId: capture.id,
          capturedBy: capture.capturedBy || null,
          capturedAt: capture.capturedAt || Date.now(),
        }

        // Foto: usar o base64 da capture (se imagem)
        if (capture.type === 'image' && capture.base64) {
          // Formato data URL para exibição directa
          const dataUrl = capture.base64.startsWith('data:')
            ? capture.base64
            : `data:image/jpeg;base64,${capture.base64}`
          deptItem.photos = [dataUrl]
        } else if (capture.thumbnail) {
          deptItem.photos = [capture.thumbnail]
        }

        // Criar no store
        store.addDepartmentItem(deptItem)

        results.push({
          module: 'departments',
          label: `${deptLabel} — ${deptItem.name}`,
          success: true,
          department: dept,
        })

        // Sugestões cruzadas
        suggest('continuity', 'info',
          `Novo item de ${deptLabel} capturado — verificar continuidade das cenas associadas`,
          { sceneKey: interpretation.scene, department: dept })
        if (['wardrobe', 'props', 'art'].includes(dept)) {
          suggest('budget', 'action',
            `Novo item de ${deptLabel} — considerar impacto no orçamento`,
            { department: dept })
        }

        // Se continuity flag → criar entrada de continuidade
        if (interpretation.continuity && interpretation.scene) {
          try {
            createContinuityEntry(store, {
              sceneKey: interpretation.scene,
              department: dept,
              description: interpretation.descricao || deptItem.name,
              character: interpretation.character,
              photo: deptItem.photos[0] || null,
              captureId: capture.id,
            })
            results.push({
              module: 'continuity',
              label: `Continuidade — ${interpretation.scene}`,
              success: true,
            })
          } catch (contErr) {
            console.warn('[routeCapture] Erro ao criar continuidade:', contErr)
          }
        }

        break
      }

      case 'guarda-roupa': {
        // Converter para department-item (wardrobe) retrocompatível
        const wardrobeItem = {
          name: interpretation.descricao || 'Guarda-roupa capturado',
          department: 'wardrobe',
          characterName: interpretation.character || '',
          locationName: interpretation.location || '',
          scenes: interpretation.scene ? [interpretation.scene] : [],
          photos: [],
          notes: interpretation.texto_extraido || capture.textContent || '',
          approved: false,
          fromCapture: true,
          captureId: capture.id,
        }
        if (capture.type === 'image' && capture.base64) {
          wardrobeItem.photos = [capture.base64.startsWith('data:') ? capture.base64 : `data:image/jpeg;base64,${capture.base64}`]
        }
        store.addDepartmentItem(wardrobeItem)
        results.push({ module: 'departments', label: 'Guarda-Roupa', success: true, department: 'wardrobe' })

        // Sugestão cruzada
        const charRef = interpretation.character
        suggest('continuity', 'info',
          `Novo figurino capturado${charRef ? ' para ' + charRef : ''} — verificar continuidade`,
          { department: 'wardrobe', character: charRef || null })

        // Backup como captureNote
        store.addCaptureNote({
          id: capture.id,
          categoria: 'guarda-roupa',
          descricao: interpretation.descricao || '',
          texto: interpretation.texto_extraido || capture.textContent || '',
          base64Key: capture.id,
          timestamp: Date.now(),
          answers,
        })
        break
      }

      case 'local': {
        const locName = answers?.nome_local ||
                        interpretation.texto_extraido ||
                        interpretation.descricao ||
                        `Local capturado ${new Date().toLocaleDateString('pt-PT')}`
        const newLoc = {
          id: `loc_${Date.now()}`,
          name: locName,
          displayName: locName,
          type: 'exterior',
          status: 'identificado',
          address: answers?.morada || '',
          notes: interpretation.descricao || '',
          photos: capture.type === 'image' ? { before: capture.id } : {},
          fromCapture: true,
          captureId: capture.id,
        }
        store.addLocation(newLoc)
        results.push({ module: 'local', label: 'Locais', success: true })

        // Sugestão cruzada
        suggest('production', 'action',
          `Novo local identificado: ${locName} — atribuir a cenas na produção`,
          { locationId: newLoc.id, locationName: locName })

        break
      }

      case 'nota-realizador': {
        store.addCaptureNote({
          id: capture.id,
          categoria: 'realizador',
          descricao: interpretation.descricao || '',
          texto: interpretation.texto_extraido || capture.textContent || '',
          base64Key: capture.type === 'image' ? capture.id : null,
          timestamp: Date.now(),
          answers,
        })
        results.push({ module: 'nota-realizador', label: 'Notas do Realizador', success: true })

        // Sugestão cruzada
        suggest('mirror', 'info',
          'Nova nota do realizador capturada — rever no Espelho',
          {})

        break
      }

      case 'prop': {
        // Converter para department-item (props)
        const propItem = {
          name: interpretation.descricao || 'Adereço capturado',
          department: 'props',
          characterName: interpretation.character || '',
          locationName: interpretation.location || '',
          scenes: interpretation.scene ? [interpretation.scene] : [],
          photos: [],
          notes: interpretation.texto_extraido || capture.textContent || '',
          approved: false,
          fromCapture: true,
          captureId: capture.id,
        }
        if (capture.type === 'image' && capture.base64) {
          propItem.photos = [capture.base64.startsWith('data:') ? capture.base64 : `data:image/jpeg;base64,${capture.base64}`]
        }
        store.addDepartmentItem(propItem)
        results.push({ module: 'departments', label: 'Adereços', success: true, department: 'props' })

        // Sugestões cruzadas
        suggest('continuity', 'info',
          'Novo adereço capturado — verificar continuidade',
          { department: 'props' })
        suggest('budget', 'action',
          'Novo adereço — considerar impacto no orçamento',
          { department: 'props' })

        // Backup
        store.addCaptureNote({
          id: capture.id,
          categoria: 'aderecos',
          descricao: interpretation.descricao || '',
          texto: interpretation.texto_extraido || capture.textContent || '',
          base64Key: capture.type === 'image' ? capture.id : null,
          timestamp: Date.now(),
          answers,
        })
        break
      }

      case 'recibo': {
        // Extrair valor e descrição da interpretação
        const amount = interpretation.extractedAmount || 0
        const desc = interpretation.description || interpretation.descricao || 'Despesa capturada'

        // Tentar adicionar como despesa ao orçamento activo
        const budgets = store.budgets || []
        if (budgets.length > 0) {
          const activeBudget = budgets[0]
          if (store.addBudgetExpense) {
            store.addBudgetExpense(activeBudget.id, {
              id: `exp_${Date.now()}`,
              descricao: desc,
              valor: amount,
              categoria: interpretation.budgetCategory || 7,
              estado: 'pendente',
              origem: 'capture',
              captureId: capture.id,
              data: new Date().toISOString().split('T')[0],
              comprovativo: capture.type === 'image' ? capture.id : '',
            })
          } else {
            store.updateBudget(activeBudget.id, {
              expenses: [...(activeBudget.expenses || []), {
                id: `exp_${Date.now()}`,
                descricao: desc,
                valor: amount,
                categoria: interpretation.budgetCategory || 7,
                estado: 'pendente',
                origem: 'capture',
                captureId: capture.id,
                data: new Date().toISOString().split('T')[0],
                comprovativo: capture.type === 'image' ? capture.id : '',
              }]
            })
          }
          results.push({ module: 'recibo', label: `Orçamento — ${amount ? amount + '€' : 'valor pendente'}`, success: true })
        } else {
          results.push({ module: 'recibo', label: 'Orçamento (sem orçamento activo)', success: true })
        }

        // Sugestão cruzada
        suggest('budget', 'action',
          `Novo recibo capturado (${amount ? amount + '€' : 'valor pendente'}) — rever no orçamento`,
          { amount })

        // Guardar também como captureNote (backup)
        store.addCaptureNote({
          id: `cn_${Date.now()}`,
          categoria: 'recibo',
          descricao: desc,
          texto: interpretation.texto_extraido || capture.textContent || '',
          base64Key: capture.type === 'image' ? capture.id : null,
          timestamp: Date.now(),
          valor: amount,
          answers,
        })
        break
      }

      case 'casting': {
        // Tenta associar a um membro da equipa existente
        const memberName = answers?.nome_actor || interpretation.texto_extraido || ''
        const existingMember = memberName
          ? store.team?.find(m => m.name?.toLowerCase().includes(memberName.toLowerCase()))
          : null

        if (existingMember) {
          store.updateMember(existingMember.id, {
            captureNotes: [
              ...(existingMember.captureNotes || []),
              {
                id: capture.id,
                descricao: interpretation.descricao,
                timestamp: Date.now(),
              },
            ],
          })
          results.push({ module: 'casting', label: `Casting — ${existingMember.name}`, success: true })

          // Sugestão cruzada
          suggest('team', 'info',
            'Nova informação de casting capturada — rever na equipa',
            { memberId: existingMember.id })

        } else {
          store.addCaptureNote({
            id: capture.id,
            categoria: 'casting',
            descricao: interpretation.descricao || '',
            texto: interpretation.texto_extraido || capture.textContent || '',
            base64Key: capture.type === 'image' ? capture.id : null,
            timestamp: Date.now(),
            answers,
          })
          results.push({ module: 'casting', label: 'Casting (sem actor associado)', success: true })

          // Sugestão cruzada
          suggest('team', 'action',
            'Nova informação de casting capturada — rever na equipa',
            {})

        }
        break
      }

      case 'referencia':
      default: {
        store.addCaptureNote({
          id: capture.id,
          categoria: 'referencia',
          descricao: interpretation.descricao || '',
          texto: interpretation.texto_extraido || capture.textContent || '',
          base64Key: capture.type === 'image' ? capture.id : null,
          timestamp: Date.now(),
          answers,
        })
        results.push({ module: 'referencia', label: 'Referências', success: true })
        break
      }
    }
  } catch (err) {
    console.error('[routeCapture] Erro ao encaminhar:', err)
    results.push({ module: destino, label: destino, success: false, error: err.message })
  }

  return results
}

/**
 * Cria uma entrada de continuidade para uma cena.
 * Usa o store.continuityData (migrado de localStorage).
 */
function createContinuityEntry(store, { sceneKey, department, description, character, photo, captureId }) {
  // Mapear departamento → categoria de continuidade
  const deptToCat = {
    wardrobe: 'wardrobe',
    props:    'props',
    makeup:   'makeup',
    hair:     'makeup',  // cabelo vai para maquilhagem
    art:      'props',   // arte vai para adereços/décor
    sfx:      'notes',
    camera:   'notes',
    lighting: 'notes',
    sound:    'notes',
    vfx:      'notes',
    vehicles: 'notes',
    stunts:   'notes',
  }
  const category = deptToCat[department] || 'notes'

  // Ler dados actuais da cena
  const existingData = store.continuityData?.[sceneKey] || {}

  // Construir texto com prefixo de personagem se aplicável
  const prefix = character ? `[${character}] ` : ''
  const existing = existingData[category] || ''
  const newEntry = `${prefix}${description} (capture: ${captureId})`
  const updatedText = existing ? `${existing}\n${newEntry}` : newEntry

  // Actualizar fotos se houver foto
  const photos = [...(existingData.photos || [])]
  if (photo) {
    photos.push({
      id: Date.now(),
      url: photo,
      caption: `${department}: ${description}`.slice(0, 80),
      fromCapture: true,
    })
  }

  // Escrever no store
  store.setContinuityScene(sceneKey, {
    ...existingData,
    [category]: updatedText,
    photos,
  })

  // Também guardar em localStorage para compatibilidade (frame_continuity)
  try {
    const lsKey = 'frame_continuity'
    const lsData = JSON.parse(localStorage.getItem(lsKey) || '{}')
    lsData[sceneKey] = {
      ...lsData[sceneKey],
      [category]: updatedText,
      photos,
    }
    localStorage.setItem(lsKey, JSON.stringify(lsData))
  } catch {
    // Silencioso — o store é a fonte primária
  }
}

function mapManualDest(label) {
  const map = {
    'Guarda-Roupa': 'department-item',
    'Local': 'local',
    'Nota Realizador': 'nota-realizador',
    'Adereço': 'department-item',
    'Referência': 'referencia',
    'Recibo': 'recibo',
    'Casting': 'casting',
    'Departamento': 'department-item',
  }
  return map[label] || 'referencia'
}

/**
 * Etiqueta legível para um tipo/módulo de destino.
 */
export function destinoLabel(modulo) {
  const labels = {
    'department-item': 'Departamentos',
    'departments': 'Departamentos',
    'guarda-roupa': 'Guarda-Roupa',
    'local': 'Locais',
    'nota-realizador': 'Notas do Realizador',
    'prop': 'Adereços',
    'recibo': 'Orçamento',
    'casting': 'Casting',
    'referencia': 'Referências',
    'continuity': 'Continuidade',
  }
  return labels[modulo] || modulo
}
