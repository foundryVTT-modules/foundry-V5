/* global Handlebars, game, TextEditor */

/**
 * Define any helpers necessary for working with Handlebars
 * @return {Promise}
 */
export const loadHelpers = async function () {
  Handlebars.registerHelper('concat', function () {
    let outStr = ''
    for (const arg in arguments) {
      if (typeof arguments[arg] !== 'object') {
        outStr += arguments[arg]
      }
    }
    return outStr
  })

  Handlebars.registerHelper('ifeq', function (a, b, options) {
    if (a === b) {
      return options.fn(this)
    }

    return options.inverse(this)
  })

  Handlebars.registerHelper('ifnoteq', function (a, b, options) {
    if (a !== b) {
      return options.fn(this)
    }

    return options.inverse(this)
  })

  Handlebars.registerHelper('or', function (bool1, bool2) {
    return bool1 || bool2
  })

  Handlebars.registerHelper('and', function (bool1, bool2) {
    return bool1 && bool2
  })

  Handlebars.registerHelper('toLowerCase', function (str) {
    return str.toLowerCase()
  })

  Handlebars.registerHelper('toUpperCaseFirstLetter', function (str) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  })

  const capitalize = (s) => {
    if (typeof s !== 'string') return ''
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  Handlebars.registerHelper('generateFeatureLabel', function (str) {
    return 'WOD5E.'.concat(capitalize(str))
  })

  Handlebars.registerHelper('generateSkillLabel', function (str) {
    return 'WOD5E.'.concat(str.split(' ').flatMap(word => capitalize(word)).join(''))
  })

  Handlebars.registerHelper('frenzy', function (willpowerMax, willpowerAgg, willpowerSup, humanity) {
    // Return the result of the stain, or 1 at minimum.
    const stainDice = Math.max((willpowerMax - willpowerAgg - willpowerSup) + Math.floor(humanity / 3), 1)

    return stainDice
  })

  Handlebars.registerHelper('willpower', function (willpowerMax, willpowerAgg, willpowerSup) {
    // Return the result of the willpower, or 1 at minimum.
    const willpowerDice = Math.max((willpowerMax - willpowerAgg - willpowerSup), 1)

    return willpowerDice
  })

  // TODO: there exist math helpers for handlebars
  Handlebars.registerHelper('remorse', function (humanity, stain) {
    // Return the result of the stain, or 1 at minimum.
    const remorseDice = Math.max((10 - humanity - stain), 1)

    return remorseDice
  })

  Handlebars.registerHelper('harano-test', function (harano, hauglosk) {
    const haranoDice = Math.max((harano + hauglosk), 1)

    return haranoDice
  })

  Handlebars.registerHelper('hauglosk-test', function (harano, hauglosk) {
    const haugloskDice = Math.max((harano + hauglosk), 1)

    return haugloskDice
  })

  Handlebars.registerHelper('attrIf', function (attr, value, test) {
    if (value === undefined) return ''
    return value === test ? attr : ''
  })

  Handlebars.registerHelper('visibleDisciplines', function (disciplines) {
    return Object.keys(disciplines).reduce(
      (obj, key) => {
        if (disciplines[key].visible) {
          obj[key] = disciplines[key]
        }
        return obj
      },
      {}
    )
  })

  Handlebars.registerHelper('visibleEdges', function (edges) {
    return Object.keys(edges).reduce(
      (obj, key) => {
        if (edges[key].visible) {
          obj[key] = edges[key]
        }
        return obj
      },
      {}
    )
  })

  Handlebars.registerHelper('sortAbilities', function (unordered = {}) {
    if (!game.settings.get('vtm5e', 'chatRollerSortAbilities')) {
      return unordered
    }
    return Object.keys(unordered).sort().reduce(
      (obj, key) => {
        obj[key] = unordered[key]
        return obj
      },
      {}
    )
  })

  Handlebars.registerHelper('numLoop', function (num, options) {
    let ret = ''

    for (let i = 0, j = num; i < j; i++) {
      ret = ret + options.fn(i)
    }

    return ret
  })

  Handlebars.registerHelper('getDisciplineName', function (key, roll = false) {
    const disciplines = {
      animalism: 'WOD5E.Animalism',
      auspex: 'WOD5E.Auspex',
      celerity: 'WOD5E.Celerity',
      dominate: 'WOD5E.Dominate',
      fortitude: 'WOD5E.Fortitude',
      obfuscate: 'WOD5E.Obfuscate',
      potence: 'WOD5E.Potence',
      presence: 'WOD5E.Presence',
      protean: 'WOD5E.Protean',
      sorcery: 'WOD5E.BloodSorcery',
      oblivion: 'WOD5E.Oblivion',
      alchemy: 'WOD5E.ThinBloodAlchemy',
      rituals: 'WOD5E.Rituals',
      ceremonies: 'WOD5E.Ceremonies'
    }
    if (roll) {
      if (key === 'rituals') {
        return disciplines.sorcery
      } else if (key === 'ceremonies') {
        return disciplines.oblivion
      }
    }
    return disciplines[key]
  })

  Handlebars.registerHelper('getEdgeName', function (key) {
    const edges = {
      arsenal: 'WOD5E.Arsenal',
      ordnance: 'WOD5E.Ordnance',
      library: 'WOD5E.Library',
      improvisedgear: 'WOD5E.ImprovisedGear',
      globalaccess: 'WOD5E.GlobalAccess',
      dronejockey: 'WOD5E.DroneJockey',
      beastwhisperer: 'WOD5E.BeastWhisperer',
      sensetheunnatural: 'WOD5E.SenseTheUnnatural',
      repeltheunnatural: 'WOD5E.RepelTheUnnatural',
      thwarttheunnatural: 'WOD5E.ThwartTheUnnatural',
      artifact: 'WOD5E.Artifact'
    }
    return edges[key]
  })

  Handlebars.registerHelper('enrichHTML', function (text) {
    return TextEditor.enrichHTML(text, { async: false })
  })
}
