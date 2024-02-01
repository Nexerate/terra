<template>
    <div id="phase-text">
        <span v-for="(phase, index) in phases" :key="index" :style="{animationDelay: `${phase.delay}s`}" class="phase">
            {{ phase.char }}
        </span>
    </div>
</template>

<style>
.phase {
    position: relative;
    display: inline-block;
    transform-origin: center;

    transform: scale(0);
    text-transform: uppercase;

    animation: phaseIn 0.1s forwards ease-in;
}

@keyframes phaseIn {
    from {
        transform: scale(0);
    }

    to {
        transform: scale(1);
    }
}
</style>

<script setup lang='ts'>

const props = defineProps({
    text: String,
    minDelay: Number,
    maxDelay: Number
    // strength: Number
});

const phases = ref<{char: string, delay: number}[]>([])
const text = props.text ?? '';
const minDelay = props.minDelay ?? 0;
const maxDelay = props.maxDelay ?? 1;

onMounted(() => {
    // for (let i = 0; i < text.length; i++) {
    //     ph
    // }

    phases.value = text.split('').map(char => {
        return {
            char,
            delay: minDelay + (Math.random() * (maxDelay - minDelay)),
        }
    })
})



</script>

Glitchy text idea: Every random interval, 
some letters are chosen to be represented as alternative versions of themselves
For example, an "e" might change to "é", "ë" or ê
Text that changes is also offset in a random direction by a random amount, 
and slightly rotated to one side