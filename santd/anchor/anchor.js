/**
 * @file Santd anchor file
 * @author mayihui@baidu.com
 **/

import san, {DataTypes} from 'san';
import {classCreator} from '../core/util/index';
import {getScroll, on, off} from '../core/util/dom';
import Affix from '../affix';
import getRequestAnimationFrame from '../core/util/getRequestAnimationFrame';
import toStyle from 'to-style';
import './style/index';

const prefixCls = classCreator('anchor')();
const sharpMatcherRegx = /#([^#]+)$/;

const anchorContent = `
    <div class="{{prefixCls}}-wrapper {{className}}" style="{{wrapperStyle}}">
        <div class="{{anchorClasses}}">
            <div class="${prefixCls}-ink">
                <span class="{{inkClasses}}" s-ref="inkNode" />
            </div>
            <slot></slot>
        </div>
    </div>
`;

function getOffsetTop(element, container) {
    if (!element || !element.getClientRects().length) {
        return 0;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width || rect.height) {
        if (container === window) {
            container = element.ownerDocument.documentElement;
            return rect.top - container.clientTop;
        }
        return rect.top - container.getBoundingClientRect().top;
    }
    return rect.top;
}

function easeInOutCubic(t, b, c, d) {
    const cc = c - b;
    t /= d / 2;
    if (t < 1) {
        return (cc / 2) * t * t * t + b;
    }
    return (cc / 2) * ((t -= 2) * t * t + 2) + b;
}

function scrollTo(href, offsetTop = 0, getContainer, callback) {
    const container = getContainer();
    const scrollTop = getScroll(container, true);
    const raf = getRequestAnimationFrame();
    const sharpLinkMatch = sharpMatcherRegx.exec(href);
    if (!sharpLinkMatch) {
        return;
    }
    const targetElement = document.getElementById(sharpLinkMatch[1]);
    if (!targetElement) {
        return;
    }
    const eleOffsetTop = getOffsetTop(targetElement, container);
    const targetScrollTop = scrollTop + eleOffsetTop - offsetTop;
    const startTime = Date.now();
    const frameFunc = () => {
        const timestamp = Date.now();
        const time = timestamp - startTime;
        const nextScrollTop = easeInOutCubic(time, scrollTop, targetScrollTop, 450);
        if (container === window) {
            window.scrollTo(window.pageXOffset, nextScrollTop);
        }
        else {
            container.scrollTop = nextScrollTop;
        }
        if (time < 450) {
            raf(frameFunc);
        }
        else {
            callback();
        }
    };
    raf(frameFunc);
}

function getContainer() {
    return window;
}

export default san.defineComponent({
    dataTypes: {
        prefixCls: DataTypes.string,
        className: DataTypes.string,
        offsetTop: DataTypes.number,
        bounds: DataTypes.number,
        affix: DataTypes.bool,
        showInkInFixed: DataTypes.bool
    },
    initData() {
        return {
            prefixCls,
            getContainer,
            affix: true,
            showInkInFixed: false,
            activeLink: null,
            links: [],
            children: []
        };
    },
    computed: {
        anchorClasses() {
            const affix = this.data.get('affix');
            const showInkInFixed = this.data.get('showInkInFixed');
            let classArr = [prefixCls];
            !affix && !showInkInFixed && classArr.push('fixed');
            return classArr;
        },
        wrapperStyle() {
            const offsetTop = this.data.get('offsetTop');
            return {
                'max-height': offsetTop ? `calc(100vh - ${offsetTop}px)` : '100vh',
                ...toStyle.object(this.data.get('bodyStyle'))
            };
        },
        inkClasses() {
            const activeLink = this.data.get('activeLink');
            let classArr = [`${prefixCls}-ink-ball`];
            activeLink && classArr.push('visible');
            return classArr;
        }
    },
    inited() {
        this.data.set('bodyStyle', this.data.get('style'));
        this.data.set('style', {});
    },
    updated() {
        let children = this.data.get('children');
        children.forEach(child => {
            child.data.set('activeLink', this.data.get('activeLink'));
        });
        this.nextTick(() => {
            this.updateInk();
        });
    },
    attached() {
        let container = this.data.get('getContainer')();
        this._handleScroll = this.handleScroll.bind(this);
        if (this._handleScroll) {
            on(container, 'scroll', this._handleScroll);
        }
        this.handleScroll();
    },
    disposed() {
        let container = this.data.get('getContainer')();
        if (this._handleScroll) {
            off(container, 'scroll', this._handleScroll);
            this._handleScroll = null;
        }
    },
    handleScroll() {
        if (this.data.get('animating')) {
            return;
        }

        const {offsetTop, bounds} = this.data.get();

        this.data.set('activeLink', this.getCurrentAnchor(offsetTop, bounds));
    },
    updateInk() {
        if (typeof document === 'undefined') {
            return;
        }
        let anchorNode = this.el;
        let linkNode = anchorNode.getElementsByClassName(`${prefixCls}-link-title-active`)[0];
        if (linkNode) {
            this.ref('inkNode').style.top = `${linkNode.offsetTop + linkNode.clientHeight / 2 - 4.5}px`;
        }
    },
    getCurrentAnchor(offsetTop = 0, bounds = 5) {
        let activeLink = '';
        if (typeof document === 'undefined') {
            return activeLink;
        }

        let linkSections = [];
        let container = this.data.get('getContainer')();
        let links = this.data.get('links');
        links.forEach(link => {
            const sharpLinkMatch = sharpMatcherRegx.exec(link.toString());
            if (!sharpLinkMatch) {
                return;
            }
            let target = document.getElementById(sharpLinkMatch[1]);
            if (target) {
                const top = getOffsetTop(target, container);
                if (top < offsetTop + bounds) {
                    linkSections.push({
                        link,
                        top
                    });
                }
            }
        });

        if (linkSections.length) {
            let maxSection = linkSections.reduce((prev, curr) => (curr.top > prev.top ? curr : prev));
            return maxSection.link;
        }
        return '';
    },
    messages: {
        santd_link_addInstance(payload) {
            this.data.push('children', payload.value);
        },
        santd_link_add(payload) {
            let links = this.data.get('links');
            if (!links.includes(payload.value)) {
                this.data.push('links', payload.value);
            }
        },
        santd_link_rm(payload) {
            let links = this.data.get('links');
            const index = links.indexOf(payload.value);
            if (index !== -1) {
                this.data.removeAt('links', index);
            }
        },
        santd_link_click(payload) {
            this.fire('click', {e: payload.value.e, link: payload.value.link});
        },
        santd_link_scrollTo(payload) {
            const {offsetTop, getContainer} = this.data.get();
            this.data.set('animating', true);
            this.data.set('activeLink', payload.value);
            scrollTo(payload.value, offsetTop, getContainer, () => {
                this.data.set('animating', false);
            });
        }
    },

    components: {
        's-affix': Affix
    },

    template: `
        <div>
            <s-affix s-if="affix" offsetTop="{{offsetTop}}">
                ${anchorContent}
            </s-affix>
            <template s-else>
                ${anchorContent}
            </template>
        </div>
    `
});