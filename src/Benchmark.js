import React from 'react';
import CodeEditor from './CodeEditor.js';
import BashOutput from './BashOutput.js';
import CompileConfig from './CompileConfig.js';
import TimeChart from './TimeChart.js';
import { Button, Row, Col, Container, Card, FormCheck, Form } from 'react-bootstrap';
import { MdTimer } from "react-icons/md";

var request = require('request');
const protocolVersion = 3;

const startCode1 = `#include <cstdio>

int main() {
    puts("Hello World");
    return 0;
}
`;
const startCode2 = `#include <iostream>

int main() {
    std::cout << "Hello World\\n";
    return 0;
}
`;
class Benchmark extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            texts: [startCode1, startCode2]
            , graph: []
            , message: ''
            , sending: false
            , compiler: "clang-8.0"
            , cppVersion: "20"
            , optim: "3"
            , clean: false
            , force: false
            , benchNames: []
            , location: props.id
            , annotation: ''
            , isAnnotated: true
            , assemblyFull: false
            , lib: "gnu"
        };
        this.graph = [];
        this.url = this.props.url;
        this.maxCodeSize = this.props.maxCodeSize;
    }
    componentDidMount() {
        if (this.props.id) {
            this.getCode(this.props.id);
        }
        this.props.onDisplay();
    }
    componentWillReceiveProps(nextProps) {
        if (this.props.id !== nextProps.id && this.state.location !== nextProps.id) {
            this.getCode(nextProps.id);
        }
    }
    getCode(id) {
        this.setState({
            sending: true,
            graph: [],
            annotation: '',
            message: ''
        });
        request.get(this.url + '/get/' + id, (err, res, body) => {
            this.setState({
                sending: false,
                clean: true,
                force: false
            });
            if (body) {
                let result = JSON.parse(body);
                if (result) {
                    if (result.result) {
                        let compiler = result.compiler === 'clang++-3.8' ? 'clang-3.8' : result.compiler;
                        this.setState({
                            texts: result.code
                            , graph: result.result.benchmarks
                            , compiler: compiler
                            , cppVersion: result.cppVersion
                            , optim: result.optim
                            , location: id
                            , lib: result.lib
                        });
                    }
                    if (result.message) {
                        this.setState({
                            message: result.message
                        });
                    }
                    if (result.annotation) {
                        this.setState({
                            annotation: result.annotation
                            , isAnnotated: true
                        });
                    } else {
                        this.setState({ isAnnotated: false });
                    }
                }
            }
        });
    }
    sendCode() {
        if (this.state.texts.some(t => t.length > this.maxCodeSize)) {
            this.setState({
                graph: [],
                annotation: '',
                message: `Your code is ${this.state.texts.length} characters long, while the maximum code size is ${this.maxCodeSize}.
If you think this limitation is stopping you in a legitimate usage of quick-bench, please contact me.`
            });
        } else {
            this.setState({
                sending: true,
                graph: [],
                annotation: '',
                message: ''
            });
            var obj = {
                "units": this.state.texts.map(c => {
                    return {
                        "code": c,
                        "compiler": this.state.compiler,
                        "optim": this.state.optim,
                        "cppVersion": this.state.cppVersion,
                        "lib": this.state.lib
                    }
                }),
                "protocolVersion": protocolVersion,
                "force": this.state.clean && this.state.force,
            };
            request({
                url: this.url
                , method: "POST"
                , json: true
                , headers: {
                    "content-type": "application/json"
                }
                , body: obj
            }, (err, res, body) => {
                this.setState({
                    sending: false,
                    clean: true,
                    force: false
                });
                if (body.result) {
                    this.setState({
                        graph: body.result.benchmarks,
                        location: body.id
                    });
                    this.props.onLocationChange(body.id);
                }
                if (body.annotation) {
                    this.setState({ annotation: body.annotation });
                }
                if (body.message) {
                    this.setState({ message: body.message });
                }
            });
        }
    }
    setDirty() {
        this.setState({
            clean: false,
            force: false
        });
    }
    textChanged(texts) {
        this.setState({ texts: texts });
        this.setDirty();
    }
    forceChanged(e) {
        this.setState({
            force: e.target.checked
        });
    }
    onCompilerChange(compiler) {
        this.setState({ compiler: compiler });
        this.setDirty();
    }
    onVersionChanged(version) {
        this.setState({ cppVersion: version });
        this.setDirty();
    }
    onOptimChange(optim) {
        this.setState({ optim: optim });
        this.setDirty();
    }
    onLibChange(lib) {
        this.setState({ lib: lib });
        this.setDirty();
    }
    toggleAnnotated(e) {
        this.setState({ isAnnotated: e.target.checked });
    }
    render() {
        return (
            <Container fluid>
                <Row className="full-size">
                    <Col sm={6} className="full-size">
                        <div className="code-editor">
                            <CodeEditor onChange={this.textChanged.bind(this)}
                                code={this.state.texts}
                                names={this.state.benchNames}
                            />
                        </div>
                    </Col>
                    <Col sm={6} className="right-block">
                        <div style={{ display: this.state.assemblyFull ? "none" : "block" }}>
                            <div className="compilation">
                                <Card body className="my-2">
                                    <CompileConfig compiler={this.state.compiler} cppVersion={this.state.cppVersion} optim={this.state.optim} lib={this.state.lib}
                                        onCompilerChange={c => this.onCompilerChange(c)}
                                        onVersionChange={v => this.onVersionChanged(v)}
                                        onOptimChange={optim => this.onOptimChange(optim)}
                                        onLibChange={lib => this.onLibChange(lib)}
                                    />
                                    <hr className="config-separator" />
                                    <Form inline>
                                        <Button variant="primary" onClick={() => this.sendCode()} disabled={this.state.sending} className="mr-2"> <MdTimer /> Run Benchmark</Button>
                                        {this.state.clean ? <FormCheck ref="force" type="checkbox" custom checked={this.state.force} id="clean-cache" onChange={this.forceChanged.bind(this)} label="Clear cached results" /> : null}
                                    </Form>
                                </Card>
                            </div>
                            <TimeChart benchmarks={this.state.graph} id={this.state.location} onNamesChange={n => this.setState({ benchNames: n })} onDescriptionChange={d => this.props.onDescriptionChange(d)} specialPalette={this.props.specialPalette} />
                            <BashOutput text={this.state.message} />
                        </div>
                    </Col>
                </Row>
            </Container>
        );
    }
}

export default Benchmark;
