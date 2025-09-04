import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js';
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

    static properties = {
      circDepth: { state: true },
      numQubits: { state: true },
      iteration: { state: true },
      visual: { state: true },
      currentData: { state: true }, // This will now hold PARSED data
      loading: { state: true },
      error: { state: true },
    };

    constructor() {
        super();
        this.circDepth = 10;
        this.numQubits = 5;
        this.iteration = 0;
        this.visual = 'Line';
        this.currentData = null;
        this.loading = false;
        this.error = '';
    }

    get canvasEl() {
        return this.renderRoot?.querySelector('#qml-canvas') ?? null;
    }

    updated(changedProperties) {
        if (this.currentData && this.canvasEl) {
            loadQubits(this.currentData, this.iteration, this.visual);
            const ctx = this.canvasEl.getContext('2d');
            draw(ctx);
        }
    }

    async handleStart() {
        this.loading = true;
        this.error = '';
        this.currentData = null;
        const key = `${this.circDepth}_${this.numQubits}`;
        let rawData = null;

        if (qmlData[key]) {
            rawData = qmlData[key];
        } else {
            // Fallback to backend
            const POST_DOMAIN = 'http://quantumstatetomography.sharankov.com:81/';
            const args = {
                circ_depth: this.circDepth,
                num_qbits: this.numQubits,
            };

            try {
                const response = await fetch(POST_DOMAIN + 'qml', {
                    method: 'POST',
                    body: JSON.stringify(args)
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                rawData = await response.json();
                if (rawData === 'Error') {
                    throw new Error('Backend returned an error.');
                }
            } catch (err) {
                console.error(err);
                this.error = 'Failed to fetch data from backend.';
                this.loading = false;
                return;
            }
        }

        if (rawData) {
            try {
                this.currentData = parseComplex(rawData);
                this.iteration = 0;
            } catch (err) {
                console.error("Error parsing data:", err);
                this.error = "Failed to parse data.";
            }
        }

        this.loading = false;
    }

    render() {
        const maxIterations = this.currentData ? this.currentData.phis.length - 1 : 0;
        return html`
      <p>Press start to load pre-cached data for a random quantum state visualization. If data is not cached, it will be fetched from the backend.</p>
      <div class="controls">
        <sl-range label="Circuit Depth" min="1" max="10" .value=${this.circDepth} @sl-change=${e => this.circDepth = e.target.value}></sl-range>
        <sl-range label="Number of Qubits" min="1" max="6" .value=${this.numQubits} @sl-change=${e => this.numQubits = e.target.value}></sl-range>
        <sl-button @click=${this.handleStart} .loading=${this.loading}>START</sl-button>
        <sl-select label="Visual" .value=${this.visual} @sl-change=${e => this.visual = e.target.value}>
          <sl-option value="Line">Line</sl-option>
          <sl-option value="Trail">Trail</sl-option>
        </sl-select>
      </div>
      ${this.error ? html`<p class="error">${this.error}</p>` : ''}
      <canvas id="qml-canvas" width=${CANVAS_SIZE} height=${CANVAS_SIZE}></canvas>
      ${this.currentData ? html`
        <sl-range label="Iteration" min="0" max=${maxIterations} .value=${this.iteration} @sl-change=${e => this.iteration = e.target.value}></sl-range>
      ` : ''}
    `;
    }
}
customElements.define('qml-demo', QmlDemo);


export class QubitDisplay extends LitElement {
    static styles = css`
        :host { display: block; margin-bottom: 1rem; }
        .qubit-form { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
        img { width: 150px; height: 150px; border: 1px solid white; }
        .inputs { display: flex; flex-direction: column; gap: 0.5rem; }
        .actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
        .equation { margin-left: 1rem; font-family: monospace; font-size: 1.2rem; }
    `;

    static properties = {
      id: { type: Number },
      qubitState: { type: Object },
      image: { type: String },
    };

    constructor() {
        super();
        this.id = 0;
        this.qubitState = { r0: '1', i0: '0', r1: '0', i1: '0' };
        this.image = null;
    }

    get equation() {
        const r0 = this.renderRoot.querySelector('[name="r0"]')?.value || '0';
        const i0 = this.renderRoot.querySelector('[name="i0"]')?.value || '0';
        const r1 = this.renderRoot.querySelector('[name="r1"]')?.value || '0';
        const i1 = this.renderRoot.querySelector('[name="i1"]')?.value || '0';

        const c0 = new Complex(parseFloat(r0), parseFloat(i0));
        const c1 = new Complex(parseFloat(r1), parseFloat(i1));

        const formatPart = (c) => {
            if (c.im === 0) return `${c.re}`;
            if (c.re === 0) return `${c.im}i`;
            return `${c.re} ${c.im > 0 ? '+' : '-'} ${Math.abs(c.im)}i`;
        };

        return `(${formatPart(c0)})|0> + (${formatPart(c1)})|1>`;
    }

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
        const r0_input = this.renderRoot.querySelector('[name="r0"]');
        const i0_input = this.renderRoot.querySelector('[name="i0"]');
        const r1_input = this.renderRoot.querySelector('[name="r1"]');
        const i1_input = this.renderRoot.querySelector('[name="i1"]');

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

        this.qubitState = { r0: new_r0, i0: new_i0, r1: new_r1, i1: new_i1 };
        this.requestUpdate('equation'); // To re-render the equation
    }

    // We need to re-render the equation whenever an input changes
    handleInputChange() {
        this.requestUpdate('equation');
    }

    render() {
        return html`
            <h4>Qubit ${this.id}</h4>
            <div class="qubit-form">
                ${this.image ? html`<img src="data:image/png;base64,${this.image}" alt="Bloch Sphere">` : html`<div style="width: 150px; height: 150px; border: 1px dashed white; display: flex; align-items: center; justify-content: center;">No Image</div>`}
                <form @submit=${this.handleSubmit}>
                    <div class="inputs" @input=${this.handleInputChange}>
                        <sl-input type="number" step="any" name="r0" label="Real |0>" .value=${this.qubitState.r0}></sl-input>
                        <sl-input type="number" step="any" name="i0" label="Imaginary |0>" .value=${this.qubitState.i0}></sl-input>
                        <sl-input type="number" step="any" name="r1" label="Real |1>" .value=${this.qubitState.r1}></sl-input>
                        <sl-input type="number" step="any" name="i1" label="Imaginary |1>" .value=${this.qubitState.i1}></sl-input>
                    </div>
                    <div class="actions">
                        <sl-button @click=${this.handleNormalize} size="small">Normalize</sl-button>
                        <sl-button type="submit" variant="primary" size="small">Submit</sl-button>
                    </div>
                </form>
                <div class="equation">
                    <h3>${this.equation}</h3>
                </div>
            </div>
        `;
    }
}
customElements.define('qubit-display', QubitDisplay);


export class QubitVisualizer extends LitElement {
    static styles = css`
        .controls { display: flex; gap: 1rem; align-items: flex-end; margin-bottom: 1rem; }
    `;

    static properties = {
      quantity: { state: true },
      managers: { state: true },
    };

    constructor() {
        super();
        this.quantity = 1;
        this.managers = [{ id: 1, image: null }];
    }

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
        const managerIndex = this.managers.findIndex(m => m.id === id);
        if (managerIndex === -1) return;

        const POST_DOMAIN = 'http://quantumstatetomography.sharankov.com:81/';
        try {
            const response = await fetch(POST_DOMAIN + 'multivector', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Assuming the backend returns a JSON object with a base64 image string.
            const reply = await response.json();
            const base64data = reply.image;

            if (!base64data) {
                throw new Error("No image data in backend response.");
            }

            const newManagers = [...this.managers];
            newManagers[managerIndex] = { ...newManagers[managerIndex], image: base64data };
            this.managers = newManagers;
        } catch (error) {
            console.error('Error fetching qubit image:', error);
        }
    }

    render() {
        return html`
            <div class="controls">
                <sl-input type="number" label="Number of Qubits" min="1" .value=${this.quantity} @sl-change=${this.handleQuantityChange}></sl-input>
            </div>
            <div @qubit-submit=${this.handleQubitSubmit}>
                ${this.managers.map(manager => html`
                    <qubit-display .id=${manager.id} .image=${manager.image}></qubit-display>
                `)}
            </div>
        `;
    }
}
customElements.define('qubit-visualizer', QubitVisualizer);


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

      <sl-card>
        <div slot="header">Why Quantum?</div>
        <p>Quantum computers can solve problems classical computers could never come close to simulating. Simulating protein folding would allow for modelling drugs and disease; potentially opening up a cure to cancer in the far future. Similarly, the ability to model complex molecules and lattices will dramatically advance material science leading to a world of smart materials and prolific nanotechnology.</p>
        <p>The first step to making a quantum computer is measuring, understanding, and predicting quantum states. Only through quantum state tomagraphy can we begin designing computers using the power of light or atoms.</p>
      </sl-card>
    `;
    }
}
customElements.define('quantum-app', QuantumApp);
