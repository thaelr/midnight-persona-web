import type {Transition} from 'motion/react';

// Small shared vocabulary: presses settle quickly; spatial moves keep continuity.
export const pressTransition:Transition={type:'spring',stiffness:750,damping:38,mass:.45};
export const sharedTransition:Transition={type:'spring',stiffness:280,damping:31,mass:.9};
export const carouselTransition:Transition={type:'spring',stiffness:300,damping:32,mass:.8};
export const shortTransition:Transition={duration:.16,ease:[.2,.7,.2,1]};
export const reducedTransition:Transition={duration:0};
