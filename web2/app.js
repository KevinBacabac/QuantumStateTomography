import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js';
import { customElement, property, state, query } from 'https://cdn.jsdelivr.net/gh/lit/dist@2/decorators.js';
import { qmlData } from './data.js';
import { draw, loadQubits, CANVAS_SIZE } from './lib/QMLCanvas.js';

// Helper function to parse complex numbers from data
function parseComplex(data) {
    const complexData = { ...data };
    complexData.phis = data.phis.map(state => {
        const newState = {};
        for (const [key, value] of Object.entries(state)) {
            newState[key] = new Complex(value[0], value[1]);
        }
        return newState;
    });
    return complexData;
}


@customElement('qml-demo')
export class QmlDemo extends LitElement {
    static styles = css`
    :host {
      display: block;
    }
    .controls {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }
    sl-range {
      width: 200px;
    }
    canvas {
      border: 1px solid white;
      margin-top: 1rem;
    }
    .error {
        color: var(--sl-color-danger-500);
    }
  `;

    @state() circDepth = 10;
    @state() numQubits = 5;
    @state() iteration = 0;
    @state() visual = 'Line';
    @state() currentData = null;
    @state() loading = false;
    @state() error = '';

    @query('#qml-canvas') canvasEl;

    updated(changedProperties) {
        if (this.currentData && this.canvasEl) {
            if (changedProperties.has('iteration') || changedProperties.has('visual') || changedProperties.has('currentData')) {
                const parsedData = parseComplex(this.currentData);
                loadQubits(parsedData, this.iteration, this.visual);
            }
            const ctx = this.canvasEl.getContext('2d');
            draw(ctx);
        }
    }

    handleStart() {
        this.loading = true;
        this.error = '';
        const key = `${this.circDepth}_${this.numQubits}`;
        if (qmlData[key]) {
            this.currentData = qmlData[key];
            this.iteration = 0;
            this.loading = false;
        } else {
            this.currentData = null;
            this.error = 'No pre-cached data available for these parameters.';
            this.loading = false;
        }
    }

    render() {
        const maxIterations = this.currentData ? this.currentData.phis.length - 1 : 0;
        return html`
      <p>Press start to load pre-cached data for a random quantum state visualization.</p>
      <div class="controls">
        <sl-range label="Circuit Depth" min="1" max="10" value=${this.circDepth} @sl-change=${e => this.circDepth = e.target.value}></sl-range>
        <sl-range label="Number of Qubits" min="1" max="6" value=${this.numQubits} @sl-change=${e => this.numQubits = e.target.value}></sl-range>
        <sl-button @click=${this.handleStart} .loading=${this.loading}>START</sl-button>
        <sl-select label="Visual" value=${this.visual} @sl-change=${e => this.visual = e.target.value}>
          <sl-option value="Line">Line</sl-option>
          <sl-option value="Trail">Trail</sl-option>
        </sl-select>
      </div>
      ${this.error ? html`<p class="error">${this.error}</p>` : ''}
      <canvas id="qml-canvas" width=${CANVAS_SIZE} height=${CANVAS_SIZE}></canvas>
      ${this.currentData ? html`
        <sl-range label="Iteration" min="0" max=${maxIterations} value=${this.iteration} @sl-change=${e => this.iteration = e.target.value}></sl-range>
      ` : ''}
    `;
    }
}

@customElement('qubit-display')
export class QubitDisplay extends LitElement {
    static styles = css`
        :host { display: block; margin-bottom: 1rem; }
        .qubit-form { display: flex; gap: 1rem; align-items: flex-end; }
        img { width: 150px; height: 150px; border: 1px solid white; }
        .inputs { display: flex; flex-direction: column; gap: 0.5rem; }
        .actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
    `;

    @property({ type: Number }) id = 0;
    @property({ type: Object }) qubitState = { r0: '1', i0: '0', r1: '0', i1: '0' };
    @property({ type: String }) image = null;

    handleSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        this.dispatchEvent(new CustomEvent('qubit-submit', {
            detail: { id: this.id, data },
            bubbles: true,
            composed: true,
        }));
    }

    handleNormalize() {
        const r0_input = this.shadowRoot.querySelector('[name="r0"]');
        const i0_input = this.shadowRoot.querySelector('[name="i0"]');
        const r1_input = this.shadowRoot.querySelector('[name="r1"]');
        const i1_input = this.shadowRoot.querySelector('[name="i1"]');

        const r0 = parseFloat(r0_input.value);
        const i0 = parseFloat(i0_input.value);
        const r1 = parseFloat(r1_input.value);
        const i1 = parseFloat(i1_input.value);

        const norm = Math.sqrt(r0*r0 + i0*i0 + r1*r1 + i1*i1);
        if (norm === 0) return;

        const new_r0 = (r0 / norm).toFixed(3);
        const new_i0 = (i0 / norm).toFixed(3);
        const new_r1 = (r1 / norm).toFixed(3);
        const new_i1 = (i1 / norm).toFixed(3);

        r0_input.value = new_r0;
        i0_input.value = new_i0;
        r1_input.value = new_r1;
        i1_input.value = new_i1;

        this.qubitState = {
            r0: new_r0,
            i0: new_i0,
            r1: new_r1,
            i1: new_i1,
        };
    }

    render() {
        return html`
            <h4>Qubit ${this.id}</h4>
            <div class="qubit-form">
                ${this.image ? html`<img src="data:image/png;base64,${this.image}" alt="Bloch Sphere">` : html`<div style="width: 150px; height: 150px; border: 1px dashed white; display: flex; align-items: center; justify-content: center;">No Image</div>`}
                <form @submit=${this.handleSubmit}>
                    <div class="inputs">
                        <sl-input type="number" step="0.01" name="r0" label="Real |0>" value=${this.qubitState.r0}></sl-input>
                        <sl-input type="number" step="0.01" name="i0" label="Imaginary |0>" value=${this.qubitState.i0}></sl-input>
                        <sl-input type="number" step="0.01" name="r1" label="Real |1>" value=${this.qubitState.r1}></sl-input>
                        <sl-input type="number" step="0.01" name="i1" label="Imaginary |1>" value=${this.qubitState.i1}></sl-input>
                    </div>
                    <div class="actions">
                        <sl-button @click=${this.handleNormalize} size="small">Normalize</sl-button>
                        <sl-button type="submit" variant="primary" size="small">Submit</sl-button>
                    </div>
                </form>
            </div>
        `;
    }
}

@customElement('qubit-visualizer')
export class QubitVisualizer extends LitElement {
    static styles = css`
        .controls { display: flex; gap: 1rem; align-items: flex-end; margin-bottom: 1rem; }
    `;

    @state() quantity = 1;
    @state() managers = [{ id: 1, image: null }];

    handleQuantityChange(e) {
        const newQuantity = Math.max(1, parseInt(e.target.value, 10));
        this.quantity = newQuantity;
        if (this.quantity !== this.managers.length) {
            const newManagers = [];
            for (let i = 0; i < this.quantity; i++) {
                newManagers.push(this.managers[i] || { id: i + 1, image: null });
            }
            this.managers = newManagers;
        }
    }

    async handleQubitSubmit(e) {
        const { id, data } = e.detail;
        const manager = this.managers.find(m => m.id === id);
        if (!manager) return;

        const POST_DOMAIN = 'http://quantumstatetomography.sharankov.com:81/';
        try {
            const response = await fetch(POST_DOMAIN + 'multivector', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            const imgResponse = await response.blob();
            const reader = new FileReader();
            reader.readAsDataURL(imgResponse);
            reader.onloadend = () => {
                const base64data = reader.result.split(',')[1];
                manager.image = base64data;
                this.requestUpdate();
            };
        } catch (error) {
            console.error('Error fetching qubit image:', error);
        }
    }

    render() {
        return html`
            <div class="controls">
                <sl-input type="number" label="Number of Qubits" min="1" value=${this.quantity} @sl-change=${this.handleQuantityChange}></sl-input>
            </div>
            <div @qubit-submit=${this.handleQubitSubmit}>
                ${this.managers.map(manager => html`
                    <qubit-display .id=${manager.id} .image=${manager.image}></qubit-display>
                `)}
            </div>
        `;
    }
}

@customElement('quantum-app')
export class QuantumApp extends LitElement {
    static styles = css`
    :host {
      display: block;
      padding: 1rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    sl-card {
      margin-bottom: 2rem;
    }
    sl-card::part(header) {
      font-size: 1.5rem;
    }
    p {
        font-size: 0.9rem;
        line-height: 1.5;
        color: var(--sl-color-neutral-300);
    }
  `;

    render() {
        return html`
      <sl-card>
        <div slot="header">Single Qubit Visualizer</div>
        <p>Use this module to visualize qubits on the Bloch sphere. Enter coefficients for the |0> and |1> states, and press "Submit" to generate the visualization. The "Normalize" button will adjust the coefficients to be a valid quantum state.</p>
        <qubit-visualizer></qubit-visualizer>
      </sl-card>

      <sl-card>
        <div slot="header">Quantum Machine Learning Demo</div>
        <qml-demo></qml-demo>
      </sl-card>
    `;
    }
}
