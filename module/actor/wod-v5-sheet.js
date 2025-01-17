/* global DEFAULT_TOKEN, ChatMessage, duplicate, ActorSheet, game, renderTemplate, Dialog, TextEditor */

import { rollDice } from './roll-dice.js'
import { rollHunterDice } from './roll-hunter-dice.js'
import { rollWerewolfDice } from './roll-werewolf-dice.js'
import { rollBasicDice } from './roll-basic-dice.js'

/**
 * Extend the base ActorSheet document and put all our base functionality here
 * @extends {ActorSheet}
 */
export class WoDActor extends ActorSheet {
  /** @override */
  async getData () {
    const data = await super.getData()
    data.isCharacter = this.isCharacter
    data.locked = this.locked
    const actorData = this.object.system
    const actorHeaders = actorData.headers

    if (this.object.type !== 'cell' && this.object.type !== 'coterie') {
      this._onHealthChange()
      this._onWillpowerChange()
    }

    data.displayBanner = game.settings.get('vtm5e', 'actorBanner')

    // Enrich non-header editor fields
    if (actorData.biography) { data.enrichedBiography = await TextEditor.enrichHTML(actorData.biography, { async: true }) }
    if (actorData.appearance) { data.enrichedAppearance = await TextEditor.enrichHTML(actorData.appearance, { async: true }) }
    if (actorData.notes) { data.enrichedNotes = await TextEditor.enrichHTML(actorData.notes, { async: true }) }
    if (actorData.equipment) { data.enrichedEquipment = await TextEditor.enrichHTML(actorData.equipment, { async: true }) }

    // Enrich actor header editor fields
    if (actorHeaders) {
      if (actorHeaders.tenets) { data.enrichedTenets = await TextEditor.enrichHTML(actorHeaders.tenets, { async: true }) }
      if (actorHeaders.touchstones) { data.enrichedTouchstones = await TextEditor.enrichHTML(actorHeaders.touchstones, { async: true }) }

      // Vampire stuff
      if (actorHeaders.bane) { data.enrichedBane = await TextEditor.enrichHTML(actorHeaders.bane, { async: true }) }

      // Ghoul stuff
      if (actorHeaders.creedfields) { data.enrichedCreedFields = await TextEditor.enrichHTML(actorHeaders.creedfields, { async: true }) }
    }

    return data
  }

  constructor (actor, options) {
    super(actor, options)
    this.locked = true
  }

  /**
     * Organize and classify Items for all sheets.
     *
     * @param {Object} actorData The actor to prepare.
     * @return {undefined}
     * @override
     */
  _prepareItems (sheetData) {
    const actorData = sheetData.actor

    const features = {
      background: [],
      merit: [],
      flaw: []
    }

    // Initialize containers.
    const specialties = []
    const boons = []
    const customRolls = []
    const gear = []

    // Iterate through items, allocating to containers
    for (const i of sheetData.items) {
      i.img = i.img || DEFAULT_TOKEN
      if (i.type === 'item') {
        // Append to gear.
        gear.push(i)
      } else if (i.type === 'feature') {
        // Append to features.
        features[i.system.featuretype].push(i)
      } else if (i.type === 'specialty') {
        // Append to specialties.
        specialties.push(i)
      } else if (i.type === 'boon') {
        // Append to boons.
        boons.push(i)
      } else if (i.type === 'customRoll') {
        // Append to custom rolls.
        customRolls.push(i)
      }
    }

    // Assign and return
    actorData.specialties = specialties
    actorData.boons = boons
    actorData.customRolls = customRolls
    actorData.gear = gear
    actorData.features = features
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners (html) {
    super.activateListeners(html)

    // Resource squares (Health, Willpower)
    html.find('.resource-counter > .resource-counter-step').click(this._onSquareCounterChange.bind(this))
    html.find('.resource-plus').click(this._onResourceChange.bind(this))
    html.find('.resource-minus').click(this._onResourceChange.bind(this))

    // Activate the setup for the counters
    this._setupDotCounters(html)
    this._setupSquareCounters(html)

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return

    // Rollable abilities
    html.find('.rollable').click(this._onRoll.bind(this))
    html.find('.rollable-with-mod').click(this._onRollWithMod.bind(this))
    html.find('.vrollable').click(this._onRollDialog.bind(this))
    html.find('.custom-rollable').click(this._onCustomVampireRoll.bind(this))
    html.find('.specialty-rollable').click(this._onCustomVampireRoll.bind(this))

    // Lock button
    html.find('.lock-btn').click(this._onToggleLocked.bind(this))

    // Resource dots
    html.find('.resource-value > .resource-value-step').click(this._onDotCounterChange.bind(this))
    html.find('.resource-value > .resource-value-empty').click(this._onDotCounterEmpty.bind(this))

    // Add Inventory Item
    html.find('.item-create').click(this._onItemCreate.bind(this))

    // Send Inventory Item to Chat
    html.find('.item-chat').click(ev => {
      const li = $(ev.currentTarget).parents('.item')
      const item = this.actor.getEmbeddedDocument('Item', li.data('itemId'))
      renderTemplate('systems/vtm5e/templates/actor/parts/chat-message.html', {
        name: item.name,
        img: item.img,
        description: item.system.description
      }).then(html => {
        ChatMessage.create({
          content: html
        })
      })
    })

    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents('.item')
      const item = this.actor.getEmbeddedDocument('Item', li.data('itemId'))
      item.sheet.render(true)
    })

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents('.item')
      this.actor.deleteEmbeddedDocuments('Item', [li.data('itemId')])
      li.slideUp(200, () => this.render(false))
    })

    // Collapsible Features and Powers
    const coll = document.getElementsByClassName('collapsible')
    let i

    for (i = 0; i < coll.length; i++) {
      coll[i].addEventListener('click', function () {
        this.classList.toggle('active')
        const content = this.parentElement.nextElementSibling
        if (content.style.maxHeight) {
          content.style.maxHeight = null
        } else {
          content.style.maxHeight = content.scrollHeight + 'px'
        }
      })
    }
  }

  /**
   * Handle all types of resource changes
   * @param {Event} event   The originating click event
   */
  _onResourceChange (event) {
    event.preventDefault()
    const actorData = duplicate(this.actor)
    const element = event.currentTarget
    const dataset = element.dataset
    const resource = dataset.resource

    // If the sheet is unlocked, handle adding and subtracting
    // the number of boxes
    if (dataset.action === 'plus' && !this.locked) {
      actorData.system[resource].max++
    } else if (dataset.action === 'minus' && !this.locked) {
      actorData.system[resource].max = Math.max(actorData.system[resource].max - 1, 0)
    }

    if (actorData.system[resource].aggravated + actorData.system[resource].superficial > actorData.system[resource].max) {
      actorData.system[resource].aggravated = actorData.system[resource].max - actorData.system[resource].superficial
      if (actorData.system[resource].aggravated <= 0) {
        actorData.system[resource].aggravated = 0
        actorData.system[resource].superficial = actorData.system[resource].max
      }
    }
    this.actor.update(actorData)
  }

  _setupDotCounters (html) {
    html.find('.resource-value').each(function () {
      const value = Number(this.dataset.value)
      $(this).find('.resource-value-step').each(function (i) {
        if (i + 1 <= value) {
          $(this).addClass('active')
        }
      })
    })
    html.find('.resource-value-static').each(function () {
      const value = Number(this.dataset.value)
      $(this).find('.resource-value-static-step').each(function (i) {
        if (i + 1 <= value) {
          $(this).addClass('active')
        }
      })
    })
  }

  _setupSquareCounters (html) {
    html.find('.resource-counter').each(function () {
      const data = this.dataset
      const states = parseCounterStates(data.states)
      const humanity = data.name === 'system.humanity'
      const despair = data.name === 'system.despair'

      const fulls = Number(data[states['-']]) || 0
      const halfs = Number(data[states['/']]) || 0
      const crossed = Number(data[states.x]) || 0

      let values

      // This is a little messy but it's effective.
      // Effectively we're making sure that each square
      // counter's box-filling tactic is followed properly.
      if (despair) { // Hunter-specific
        values = new Array(fulls)

        values.fill('-', 0, fulls)
      } else if (humanity) { // Vampire-specific
        values = new Array(fulls + halfs)

        values.fill('-', 0, fulls)
        values.fill('/', fulls, fulls + halfs)
      } else { // General use
        values = new Array(halfs + crossed)

        values.fill('/', 0, halfs)
        values.fill('x', halfs, halfs + crossed)
      }

      // Iterate through the data states now that they're properly defined
      $(this).find('.resource-counter-step').each(function () {
        this.dataset.state = ''
        if (this.dataset.index < values.length) {
          this.dataset.state = values[this.dataset.index]
        }
      })
    })
  }

  /**
   * Handle locking and unlocking the actor sheet
   * @param {Event} event   The originating click event
   */
  _onToggleLocked (event) {
    event.preventDefault()
    this.locked = !this.locked
    this._render()
  }

  /**
   * Handle updating the dot counter
   * @param {Event} event   The originating click event
   */
  _onDotCounterChange (event) {
    event.preventDefault()
    const element = event.currentTarget
    const dataset = element.dataset
    const index = Number(dataset.index)
    const parent = $(element.parentNode)
    const fieldStrings = parent[0].dataset.name
    const fields = fieldStrings.split('.')
    const steps = parent.find('.resource-value-step')

    // Make sure that the dot counter can only be changed if the sheet is
    // unlocked or if it's the hunger track.
    if (this.locked && !parent.has('.hunger-value').length) return

    if (index < 0 || index > steps.length) {
      return
    }

    // Handle editing the steps on the dot counter
    steps.removeClass('active')
    steps.each(function (i) {
      if (i <= index) {
        $(this).addClass('active')
      }
    })
    // Update the actor field
    this._assignToActorField(fields, index + 1)
  }

  /**
   * Handle when the dot counter's empty field is pressed
   * @param {Event} event   The originating click event
   */
  _onDotCounterEmpty (event) {
    event.preventDefault()
    const element = event.currentTarget
    const parent = $(element.parentNode)
    const fieldStrings = parent[0].dataset.name
    const fields = fieldStrings.split('.')
    const steps = parent.find('.resource-value-empty')

    // Make sure that the dot counter can only be changed if the sheet is
    // unlocked or if it's the hunger track.
    if (this.locked && !parent.has('.hunger-value').length) return

    // Update the actor field
    steps.removeClass('active')
    this._assignToActorField(fields, 0)
  }

  _onSquareCounterChange (event) {
    event.preventDefault()
    const element = event.currentTarget
    const index = Number(element.dataset.index)
    const oldState = element.dataset.state || ''
    const parent = $(element.parentNode)
    const data = parent[0].dataset
    const states = parseCounterStates(data.states)
    const fields = data.name.split('.')
    const steps = parent.find('.resource-counter-step')
    const humanity = data.name === 'system.humanity'
    const despair = data.name === 'system.despair'
    const fulls = Number(data[states['-']]) || 0
    const halfs = Number(data[states['/']]) || 0
    const crossed = Number(data[states.x]) || 0

    if (index < 0 || index > steps.length) {
      return
    }

    const allStates = ['', ...Object.keys(states)]
    const currentState = allStates.indexOf(oldState)
    if (currentState < 0) {
      return
    }

    const newState = allStates[(currentState + 1) % allStates.length]
    steps[index].dataset.state = newState

    if ((oldState !== '' && oldState !== '-') || (oldState !== '' && humanity)) {
      data[states[oldState]] = Number(data[states[oldState]]) - 1
    }

    // If the step was removed we also need to subtract from the maximum.
    if (oldState !== '' && newState === '' && !humanity && !despair) {
      data[states['-']] = Number(data[states['-']]) - 1
    }

    if (newState !== '') {
      data[states[newState]] = Number(data[states[newState]]) + Math.max(index + 1 - fulls - halfs - crossed, 1)
    }

    const newValue = Object.values(states).reduce(function (obj, k) {
      obj[k] = Number(data[k]) || 0
      return obj
    }, {})

    this._assignToActorField(fields, newValue)
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @protected
   */
  _onItemCreate (event) {
    event.preventDefault()
    const header = event.currentTarget
    // Get the type of item to create.
    const type = header.dataset.type
    // Default img
    let img = '/icons/svg/item-bag.svg'
    // Grab any data associated with this control.
    const data = duplicate(header.dataset)
    if (type === 'specialty') {
      data.skill = 'academics'
    }
    if (type === 'boon') {
      data.boontype = 'Trivial'
    }
    if (type === 'customRoll') {
      data.dice1 = 'strength'
      data.dice2 = 'athletics'
    }
    if (type === 'power') {
      img = '/systems/vtm5e/assets/icons/powers/discipline.png'
    }
    if (type === 'perk') {
      img = '/systems/vtm5e/assets/icons/powers/edge.png'
    }

    // Initialize a default name.
    const name = this.getItemDefaultName(type, data)

    // Prepare the item object.
    const itemData = {
      name,
      type,
      img,
      system: data
    }
    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.system.type

    // Finally, create the item!
    return this.actor.createEmbeddedDocuments('Item', [itemData])
  }

  // Function to grab the default name of an item.
  getItemDefaultName (type, data) {
    if (type === 'feature') {
      return `${game.i18n.localize('WOD5E.' + data.featuretype.capitalize())}`
    }
    if (type === 'power') {
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

      return `${game.i18n.localize(disciplines[data.discipline])}`
    }
    if (type === 'perk') {
      return `${game.i18n.localize('WOD5E.' + data.edge.capitalize())}`
    }
    return `${game.i18n.localize('WOD5E.' + type.capitalize())}`
  }

  // There's gotta be a better way to do this but for the life of me I can't figure it out
  _assignToActorField (fields, value) {
    const actorData = duplicate(this.actor)

    // update actor owned items
    if (fields.length === 2 && fields[0] === 'items') {
      for (const item of actorData.items) {
        if (fields[1] === item._id) {
          item.system.points = value
          break
        }
      }
    } else {
      const lastField = fields.pop()
      fields.reduce((data, field) => data[field], actorData)[lastField] = value
    }
    this.actor.update(actorData)
  }

  /**
     * Handle clickable rolls activated through buttons
     * @param {Event} event   The originating click event
     * @private
     */
  _onRoll (event) {
    event.preventDefault()
    const element = event.currentTarget
    const dataset = element.dataset
    const subtractWillpower = dataset.subtractWillpower
    const numDice = dataset.roll
    const system = dataset.system
    const difficulty = dataset.difficulty

    // Define what kind of dice is appropriate to use
    if (system === 'vampire') {
      // See if we need to reduce hunger on this roll
      const increaseHunger = dataset.increaseHunger

      // Define actor's hunger dice
      const hungerDice = Math.min(this.actor.system.hunger.value, numDice, increaseHunger)

      rollDice(numDice, this.actor, `${dataset.label}`, difficulty, hungerDice)
    } else if (system === 'hunter') {
      // Define actor's desparation dice
      const desparationDice = dataset.desparationDice ? dataset.desparationDice : 0

      rollHunterDice(numDice, this.actor, `${dataset.label}`, difficulty, desparationDice)
    } else if (system === 'werewolf') {
      // Define actor's rage dice
      const rageDice = Math.max(this.actor.system.rage.value, 0)

      rollWerewolfDice(numDice, this.actor, `${dataset.label}`, difficulty, rageDice)
    } else {
      rollBasicDice(numDice, this.actor, `${dataset.label}`, 0, subtractWillpower)
    }
  }

  /**
   * Handle clickable Vampire rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRollDialog (event) {
    event.preventDefault()
    const element = event.currentTarget
    const dataset = element.dataset
    const system = dataset.system
    let options = ''

    for (const [key, value] of Object.entries(this.actor.system.abilities)) {
      options = options.concat(`<option value="${key}">${game.i18n.localize(value.name)}</option>`)
    }

    // Hunter specific modifier to a roll
    let despairBlock = ''
    if (system === 'hunter') {
      const despair = Object.values(this.actor.system.despair).toString()

      if (despair === '0') {
        despairBlock = `
        <div class="form-group">
          <label>${game.i18n.localize('WOD5E.DesperationDice')}</label>
          <input type="text" min="0" id="desparationInput" value="0">
        </div>
        `
      }
    }

    const template = `
      <form>
          <div class="form-group">
              <label>${game.i18n.localize('WOD5E.SelectAbility')}</label>
              <select id="abilitySelect">${options}</select>
          </div>  
          <div class="form-group">
              <label>${game.i18n.localize('WOD5E.Modifier')}</label>
              <input type="text" id="inputMod" value="0">
          </div>  
          <div class="form-group">` +
           // Hunter specific modifier to a roll
           despairBlock +
           `</div>
           <div class="form-group">
           <label>${game.i18n.localize('WOD5E.Difficulty')}</label>
           <input type="text" min="0" id="inputDif" value="0">
       </div>
      </form>`

    let buttons = {}
    buttons = {
      draw: {
        icon: '<i class="fas fa-check"></i>',
        label: game.i18n.localize('WOD5E.Roll'),
        callback: async (html) => {
          const ability = html.find('#abilitySelect')[0].value
          const modifier = parseInt(html.find('#inputMod')[0].value || 0)
          const difficulty = parseInt(html.find('#inputDif')[0].value || 0)
          const abilityVal = this.actor.system.abilities[ability].value
          const abilityName = game.i18n.localize(this.actor.system.abilities[ability].name)
          const numDice = abilityVal + parseInt(dataset.roll) + modifier

          // Define what kind of dice is appropriate to use
          if (system === 'vampire') {
            // Define actor's hunger dice
            // 0 if the actor is a ghoul, current hunger value if otherwise
            const hungerDice = this.actor.type === 'ghoul' ? 0 : Math.min(this.actor.system.hunger.value, numDice)

            rollDice(numDice, this.actor, `${dataset.label} + ${abilityName}`, difficulty, hungerDice)
          } else if (system === 'hunter') {
            let desparationDice

            // Define actor's desparation dice
            if (this.actor.system.despair.value === 0) {
              desparationDice = parseInt(html.find('#desparationInput')[0].value || 0)
            }

            rollHunterDice(numDice, this.actor, `${dataset.label} + ${abilityName}`, difficulty, desparationDice)
          } else if (system === 'werewolf') {
            // Define actor's rage dice
            const rageDice = Math.max(this.actor.system.rage.value, 0)

            rollWerewolfDice(numDice, this.actor, `${dataset.label} + ${abilityName}`, difficulty, rageDice)
          } else {
            rollDice(numDice, this.actor, `${dataset.label} + ${abilityName}`, difficulty)
          }
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('WOD5E.Cancel')
      }
    }

    new Dialog({
      title: game.i18n.localize('WOD5E.Rolling') + ` ${dataset.label}...`,
      content: template,
      buttons,
      default: 'draw'
    }).render(true)
  }

  _onCustomVampireRoll (event) {
    event.preventDefault()
    const element = event.currentTarget
    const dataset = element.dataset
    const system = dataset.system
    const difficulty = 0
    dataset.label = dataset.name

    if (dataset.dice1 === '') {
      const dice2 = this.actor.system.skills[dataset.dice2.toLowerCase()].value
      dataset.roll = dice2 + 1 // specialty modifier

      this._onRollDialog(event)
    } else {
      const dice1 = this.actor.system.abilities[dataset.dice1.toLowerCase()].value
      const dice2 = this.actor.system.skills[dataset.dice2.toLowerCase()].value
      const dicePool = dice1 + dice2

      // Define what kind of dice is appropriate to use
      if (system === 'vampire') {
        // Define actor's hunger dice
        const hungerDice = Math.min(this.actor.system.hunger.value, dicePool)

        rollDice(dicePool, this.actor, dataset.label, difficulty, hungerDice)
      } else if (system === 'hunter') {
        const desparationDice = dataset.desparationDice

        rollHunterDice(dicePool, this.actor, dataset.label, difficulty, desparationDice)
      } else if (system === 'werewolf') {
        // Define actor's rage dice
        const rageDice = Math.max(this.actor.system.rage.value, 0)

        rollWerewolfDice(dicePool, this.actor, dataset.label, difficulty, rageDice)
      } else {
        rollDice(dicePool, this.actor, dataset.label, difficulty)
      }
    }
  }

  _onRollWithMod (event) {
    event.preventDefault()
    const element = event.currentTarget
    const dataset = element.dataset
    const increaseHunger = dataset.increaseHunger
    const consumeRage = dataset.consumeRage
    const subtractWillpower = dataset.subtractWillpower
    const system = dataset.system

    const template = `
      <form>
          <div class="form-group">
              <label>${game.i18n.localize('WOD5E.Modifier')}</label>
              <input type="text" id="inputMod" value="0">
          </div>  
          <div class="form-group">
              <label>${game.i18n.localize('WOD5E.Difficulty')}</label>
              <input type="text" min="0" id="inputDif" value="0">
          </div>
      </form>`

    let buttons = {}
    buttons = {
      draw: {
        icon: '<i class="fas fa-check"></i>',
        label: game.i18n.localize('WOD5E.Roll'),
        callback: async (html) => {
          const modifier = parseInt(html.find('#inputMod')[0].value || 0)
          const difficulty = parseInt(html.find('#inputDif')[0].value || 0)
          const numDice = parseInt(dataset.roll) + modifier

          // Define what kind of dice is appropriate to use
          if (system === 'vampire') {
            // Define actor's hunger dice
            const hungerDice = Math.min(this.actor.system.hunger.value, numDice)

            rollDice(numDice, this.actor, dataset.label, difficulty, hungerDice, increaseHunger, subtractWillpower)
          } else if (system === 'hunter') {
            // Define actor's desparation dice
            const desparationDice = parseInt(html.find('#desparationInput')[0].value || 0)

            rollHunterDice(numDice, this.actor, dataset.label, difficulty, desparationDice)
          } else if (system === 'werewolf') {
            // Define actor's rage dice
            const rageDice = Math.max(this.actor.system.rage.value, 0)

            rollWerewolfDice(numDice, this.actor, dataset.label, difficulty, rageDice, subtractWillpower, consumeRage)
          } else {
            rollDice(numDice, this.actor, dataset.label, difficulty)
          }
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize('WOD5E.Cancel')
      }
    }

    new Dialog({
      title: `${dataset.label}`,
      content: template,
      buttons,
      default: 'draw'
    }).render(true)
  }

  _onHealthChange () {
    // Define the healthData
    const healthData = this.actor.system.health

    // Derive the character's "health value" by taking
    // the sum of the current aggravated and superficial
    // damage taken and subtracting the max by that;
    // superficial damage is reduced by half to represent
    // its lesser effect
    const derivedHealth = healthData.max - (healthData.aggravated + (healthData.superficial / 2))

    // Update the actor's health.value
    this.actor.update({ 'system.health.value': derivedHealth })
  }

  _onWillpowerChange () {
    // Define the healthData
    const willpowerData = this.actor.system.willpower

    // Derive the character's "willpower value" by taking
    // the sum of the current aggravated and superficial
    // damage taken and subtracting the max by that;
    // superficial damage is reduced by half to represent
    // its lesser effect
    const derivedWillpower = willpowerData.max - (willpowerData.aggravated + (willpowerData.superficial / 2))

    // Update the actor's health.value
    this.actor.update({ 'system.willpower.value': derivedWillpower })
  }
}

function parseCounterStates (states) {
  return states.split(',').reduce((obj, state) => {
    const [k, v] = state.split(':')
    obj[k] = v
    return obj
  }, {})
}
